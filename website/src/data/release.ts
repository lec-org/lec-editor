import downloads from "./downloads.json";

export const BASE_PATH = "/lec-editor";
export type Download = {
  name: string;
  size: number;
  sha256: string;
  github: string;
  gitee: { parts: { name: string; size: number; url: string }[]; command: string | null };
};
export type Release = { tag: string | null; commit: string | null; files: Download[] };

// 清单来自发布流水线，构建时校验地址，避免错误数据生成危险下载链接。
export function validateRelease(release: Release): Release {
  for (const file of release.files) {
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size <= 0) {
      throw new Error("制品清单校验失败");
    }
    const addresses: [string, string][] = [
      [file.github, "github.com"],
      ...file.gitee.parts.map((part) => [part.url, "gitee.com"] as [string, string]),
    ];
    for (const [url, host] of addresses) {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== host ||
        parsed.username ||
        parsed.password ||
        parsed.search
      ) {
        throw new Error("制品下载地址校验失败");
      }
    }
  }
  return release;
}

export const release = validateRelease(downloads as Release);
export const files = release.files;
export const hasGitee = files.some((file) => file.gitee.parts.length > 0);
export const version = release.tag?.replace("lec-v", "");
export const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
export const platforms = [
  {
    name: "macOS",
    key: "mac",
    arch: "Apple Silicon · ARM64",
    extension: "DMG",
    file: "line-macos-aarch64.dmg",
    icon: "⌘",
  },
  {
    name: "Windows",
    key: "windows",
    arch: "Intel / AMD · x64",
    extension: "EXE",
    file: "line-windows-x86_64.exe",
    icon: "⊞",
  },
  {
    name: "Linux",
    key: "linux",
    arch: "Intel / AMD · x64",
    extension: "TAR.GZ",
    file: "line-linux-x86_64.tar.gz",
    icon: ">_",
  },
];
