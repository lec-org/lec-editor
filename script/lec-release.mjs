import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'lec-org/lec-editor';
const packages = ['lec-editor-macos-aarch64.dmg', 'lec-editor-windows-x86_64.exe', 'lec-editor-linux-x86_64.tar.gz'];

export async function checksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

// Gitee 普通仓库单附件限 100 MB；分卷保守使用 95 MB，文件名带摘要以保证重试安全。
export async function giteeParts(path, directory, limit = 95_000_000) {
  await mkdir(directory, { recursive: true });
  const size = (await stat(path)).size;
  if (!size) throw new Error('不能发布空制品');
  const digest = await checksum(path);
  const name = `${digest.slice(0, 12)}-${basename(path)}`;
  const input = await open(path);
  const parts = [];
  try {
    for (let offset = 0, index = 1; offset < size; offset += limit, index++) {
      const buffer = Buffer.alloc(Math.min(limit, size - offset));
      let position = 0;
      while (position < buffer.length) {
        const { bytesRead } = await input.read(buffer, position, buffer.length - position, offset + position);
        if (!bytesRead) throw new Error('读取制品时提前结束');
        position += bytesRead;
      }
      const partName = size > limit ? `${name}.part${String(index).padStart(3, '0')}` : name;
      const partPath = join(directory, partName);
      await writeFile(partPath, buffer);
      parts.push({ name: partName, path: partPath, size: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
    }
  } finally {
    await input.close();
  }
  return { size, sha256: digest, parts };
}

export function publicDownloadUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'gitee.com' || url.username || url.password || url.search) {
    throw new Error('Gitee 返回了非公开下载地址');
  }
  return url.href;
}

async function publish(tag, directory) {
  if (!/^lec-v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/.test(tag)) throw new Error('无效发布标签');
  const token = process.env.GITEE_TOKEN;
  if (!token) throw new Error('请先配置仅授权 lec-editor 的 GITEE_TOKEN 仓库 Secret');
  const gh = (...args) => execFileSync('gh', [...args, '--repo', repository], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const files = (await readdir(directory)).sort();
  if (files.join(',') !== [...packages].sort().join(',')) throw new Error('三个平台的安装包必须齐全，且不能混入其他文件');
  const totalSize = (await Promise.all(files.map(async name => (await stat(join(directory, name))).size))).reduce((a, b) => a + b, 0);
  if (totalSize > 950_000_000) throw new Error('本次制品已接近 Gitee 仓库 1 GB 总附件配额，请先处理容量');

  async function gitee(path, fields, missingOk = false) {
    const url = new URL(`https://gitee.com/api/v5/repos/${repository}${path}`);
    const options = { signal: AbortSignal.timeout(600_000), redirect: 'error' };
    if (fields) {
      options.method = 'POST';
      options.body = fields instanceof FormData ? fields : new URLSearchParams(fields);
      options.body.set('access_token', token);
    } else {
      url.searchParams.set('access_token', token);
    }
    const response = await fetch(url, options);
    if (missingOk && response.status === 404) return null;
    if (!response.ok) throw new Error(`Gitee ${options.method || 'GET'} ${path} 返回 ${response.status}`);
    return response.json();
  }

  const notes = `# LEC Editor ${tag}\n\n基于 Zed 的 LEC 社区构建，保留 Zed Dev 应用名称与上游许可证。\n\n- macOS / Windows 未签名，尚未完成真机安装验收。\n- 不连接上游自动更新；新版本请从官网下载。\n- Gitee 超过 100 MB 的安装包使用分卷，下载全部分卷后按 RESTORE.md 还原，并核对 SHA256SUMS。\n\n对应源码：https://github.com/${repository}/tree/${commit}\n官网：https://lec-org.github.io/lec-editor/\n`;
  // 先建立草稿，全部附件和清单就绪后才对外发布，避免官网出现半套安装包。
  const releases = JSON.parse(gh('release', 'list', '--limit', '100', '--json', 'tagName,isDraft'));
  const existing = releases.find(release => release.tagName === tag);
  if (existing && !existing.isDraft) throw new Error('已发布版本不可覆盖，请使用新的标签');
  const notesPath = join(directory, 'RELEASE.md');
  await writeFile(notesPath, notes);
  if (!existing) gh('release', 'create', tag, '--target', commit, '--title', `LEC Editor ${tag}`, '--draft', '--notes-file', notesPath);
  const release = await gitee(`/releases/tags/${tag}`, undefined, true) || await gitee('/releases', {
    tag_name: tag, target_commitish: commit, name: `LEC Editor ${tag}`, body: notes, prerelease: 'true',
  });
  const attached = await gitee(`/releases/${release.id}/attach_files?per_page=100`);
  const manifest = { tag, commit, publishedAt: new Date().toISOString(), files: [] };
  let restore = '# Gitee 分卷还原\n\n下载同一安装包的全部分卷到同一目录，再执行对应命令。还原后核对官网列出的 SHA-256。\n\n';
  for (const name of packages) {
    const path = join(directory, name);
    const prepared = await giteeParts(path, join(directory, '.gitee'));
    const parts = [];
    for (const part of prepared.parts) {
      let uploaded = attached.find(file => file.name === part.name);
      if (uploaded && uploaded.size !== part.size) throw new Error(`同名 Gitee 附件大小不一致：${part.name}`);
      if (!uploaded) {
        const form = new FormData();
        form.set('file', new Blob([await readFile(part.path)]), part.name);
        uploaded = await gitee(`/releases/${release.id}/attach_files`, form);
      }
      parts.push({ name: part.name, size: part.size, sha256: part.sha256, url: publicDownloadUrl(uploaded.browser_download_url) });
      console.log(`Gitee 已就绪：${part.name}`);
    }
    let command = null;
    if (parts.length > 1) {
      command = name.endsWith('.exe')
        ? `cmd /c copy /b ${parts.map(p => p.name).join('+')} ${name}`
        : `cat ${parts.map(p => p.name).join(' ')} > ${name}`;
      restore += `## ${name}\n\n\`\`\`${name.endsWith('.exe') ? 'powershell' : 'sh'}\n${command}\n\`\`\`\n\n`;
    }
    manifest.files.push({ name, size: prepared.size, sha256: prepared.sha256, github: `https://github.com/${repository}/releases/download/${tag}/${name}`, gitee: { parts, command } });
    gh('release', 'upload', tag, path, '--clobber');
  }
  await writeFile(join(directory, 'downloads.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(directory, 'SHA256SUMS'), manifest.files.map(file => `${file.sha256}  ${file.name}`).join('\n') + '\n');
  await writeFile(join(directory, 'RESTORE.md'), restore);
  for (const name of ['downloads.json', 'SHA256SUMS', 'RESTORE.md']) {
    const path = join(directory, name);
    gh('release', 'upload', tag, path, '--clobber');
    // 清单使用摘要文件名，失败重试不会覆盖用户已下载的数据。
    const form = new FormData();
    const content = await readFile(path);
    form.set('file', new Blob([content]), `${createHash('sha256').update(content).digest('hex').slice(0, 12)}-${name}`);
    await gitee(`/releases/${release.id}/attach_files`, form);
  }
  gh('release', 'edit', tag, '--draft=false', '--latest');
  console.log(`已发布 ${tag}，提交 ${commit}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publish(process.argv[2], process.argv[3]).catch(error => {
    // 请求异常可能包含带令牌的 URL，只输出自行生成的错误与通用网络错误名称。
    console.error(error.cause ? `发布网络错误：${error.cause.code || error.name}` : error.message);
    process.exitCode = 1;
  });
}
