import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checksum, giteeParts, publicDownloadUrl } from './lec-release.mjs';

test('Gitee 分卷还原后与原始安装包完全一致，边界大小不分卷', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lec-release-'));
  try {
    const path = join(directory, 'editor.exe');
    const content = Buffer.from('1234567890');
    await writeFile(path, content);
    const result = await giteeParts(path, join(directory, 'parts'), 4);
    assert.deepEqual(result.parts.map(part => part.size), [4, 4, 2]);
    assert.deepEqual(Buffer.concat(await Promise.all(result.parts.map(part => readFile(part.path)))), content);
    assert.equal(result.sha256, await checksum(path));
    assert.equal((await giteeParts(path, join(directory, 'single'), 10)).parts.length, 1);
    await writeFile(path, '');
    await assert.rejects(giteeParts(path, join(directory, 'empty')), /空制品/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('公开下载地址不能携带凭据或指向其他站点', () => {
  assert.equal(publicDownloadUrl('https://gitee.com/lec-org/lec-editor/attach_files/1/download'), 'https://gitee.com/lec-org/lec-editor/attach_files/1/download');
  for (const url of ['javascript:alert(1)', 'https://evil.com/file', 'https://gitee.com/file?access_token=secret', 'https://name:secret@gitee.com/file']) {
    assert.throws(() => publicDownloadUrl(url));
  }
});
