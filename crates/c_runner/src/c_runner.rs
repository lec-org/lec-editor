use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Command, ExitStatus},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SourceLanguage {
    C,
    Cpp,
}

impl SourceLanguage {
    pub fn from_path(path: &Path) -> Option<Self> {
        let extension = path.extension()?.to_str()?;
        if extension == "C" {
            return Some(Self::Cpp);
        }
        match extension.to_ascii_lowercase().as_str() {
            "c" => Some(Self::C),
            "cc" | "cpp" | "cxx" | "c++" => Some(Self::Cpp),
            _ => None,
        }
    }

    fn compilers(self) -> &'static [&'static str] {
        match self {
            Self::C => &["clang", "gcc", "cc"],
            Self::Cpp => &["clang++", "g++", "c++"],
        }
    }

    fn standard(self) -> &'static str {
        match self {
            Self::C => "-std=c17",
            Self::Cpp => "-std=c++17",
        }
    }
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn find_compiler(language: SourceLanguage, directories: &[PathBuf]) -> Option<PathBuf> {
    for directory in directories {
        for name in language.compilers() {
            let candidate = directory.join(format!("{name}{}", env::consts::EXE_SUFFIX));
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

pub fn run_file(source: &Path) -> Result<i32, String> {
    let language = SourceLanguage::from_path(source)
        .ok_or_else(|| "请选择一个 .c、.cpp、.cc 或 .cxx 源文件。".to_owned())?;
    // Keep ordinary Windows paths compatible with compiler command lines.
    let source = dunce::canonicalize(source)
        .map_err(|error| format!("无法读取源文件 {}：{error}", source.display()))?;
    let executable = env::current_exe().map_err(|error| error.to_string())?;
    let directory = executable
        .parent()
        .ok_or_else(|| "无法定位运行工具目录。".to_owned())?;
    let mut directories = vec![directory.join("toolchains/bin")];
    if let Some(path) = env::var_os("PATH") {
        directories.extend(env::split_paths(&path).filter(|path| path.is_absolute()));
    }
    let compiler = find_compiler(language, &directories).ok_or_else(|| {
        "未找到 C/C++ 编译器。当前开发版需要系统已安装 Clang 或 GCC；内置工具链尚未随包提供。"
            .to_owned()
    })?;
    compile_and_run(&source, language, &compiler)
}

fn compile_and_run(
    source: &Path,
    language: SourceLanguage,
    compiler: &Path,
) -> Result<i32, String> {
    let directory = source
        .parent()
        .ok_or_else(|| "无法定位源文件目录。".to_owned())?;
    let output = RunDirectory::new()?;
    let program = output.0.join(format!("program{}", env::consts::EXE_SUFFIX));

    println!("正在编译 {}", source.display());
    let mut command = Command::new(compiler);
    command
        .current_dir(directory)
        .args([language.standard(), "-Wall", "-Wextra", "-g"])
        .arg(source)
        .arg("-o")
        .arg(&program);
    #[cfg(unix)]
    if language == SourceLanguage::C {
        command.arg("-lm");
    }
    let compilation = command
        .status()
        .map_err(|error| format!("无法启动编译器 {}：{error}", compiler.display()))?;
    if !compilation.success() {
        eprintln!("编译失败，请修改上面的错误后重新运行。");
        return Ok(exit_code(compilation));
    }

    println!("编译成功，开始运行。\n");
    let mut command = Command::new(&program);
    command.current_dir(directory);
    // MinGW programs may need runtime DLLs beside the compiler.
    if let Some(compiler_directory) = compiler.parent() {
        let mut directories = vec![compiler_directory.to_path_buf()];
        if let Some(path) = env::var_os("PATH") {
            directories.extend(env::split_paths(&path));
        }
        let path = env::join_paths(directories).map_err(|error| error.to_string())?;
        command.env("PATH", path);
    }
    let status = command
        .status()
        .map_err(|error| format!("无法运行程序：{error}"))?;
    let code = exit_code(status);
    println!("\n程序已结束，退出码：{code}");
    Ok(code)
}

fn exit_code(status: ExitStatus) -> i32 {
    if let Some(code) = status.code() {
        return code;
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        128 + status.signal().unwrap_or(1)
    }
    #[cfg(not(unix))]
    {
        1
    }
}

struct RunDirectory(PathBuf);

impl RunDirectory {
    fn new() -> Result<Self, String> {
        static SEQUENCE: AtomicU64 = AtomicU64::new(0);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        for _ in 0..100 {
            let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = env::temp_dir().join(format!(
                "lec-run-{}-{timestamp}-{sequence}",
                std::process::id()
            ));
            match fs::create_dir(&path) {
                Ok(()) => return Ok(Self(path)),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(format!("无法创建编译临时目录：{error}")),
            }
        }
        Err("无法创建独立的编译临时目录。".to_owned())
    }
}

impl Drop for RunDirectory {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_dir_all(&self.0) {
            eprintln!("无法清理编译临时目录 {}：{error}", self.0.display());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_source_language_without_treating_headers_as_programs() {
        for extension in ["c", "cpp", "cc", "cxx", "c++", "C", "CPP"] {
            assert!(SourceLanguage::from_path(Path::new(&format!("file.{extension}"))).is_some());
        }
        assert_eq!(
            SourceLanguage::from_path(Path::new("file.c")),
            Some(SourceLanguage::C)
        );
        assert_eq!(
            SourceLanguage::from_path(Path::new("file.C")),
            Some(SourceLanguage::Cpp)
        );
        for path in ["file.h", "file.hpp", "file.rs", "untitled", "file.c.txt"] {
            assert_eq!(SourceLanguage::from_path(Path::new(path)), None);
        }
    }

    #[test]
    fn separate_runs_get_separate_outputs_and_clean_them_up() {
        let first = RunDirectory::new().expect("first run directory");
        let second = RunDirectory::new().expect("second run directory");
        assert_ne!(first.0, second.0);
        let path = first.0.clone();
        fs::write(path.join("program"), "test output").expect("write output");
        drop(first);
        assert!(!path.exists());
        assert!(second.0.exists());
    }

    #[test]
    fn bundled_compilers_take_precedence_over_path() {
        let root = RunDirectory::new().expect("test directory");
        let bundled = root.0.join("bundled");
        let system = root.0.join("system");
        fs::create_dir(&bundled).expect("bundled directory");
        fs::create_dir(&system).expect("system directory");
        for directory in [&bundled, &system] {
            let compiler = directory.join(format!("gcc{}", env::consts::EXE_SUFFIX));
            fs::write(&compiler, "test compiler").expect("compiler file");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(compiler, fs::Permissions::from_mode(0o755))
                    .expect("executable");
            }
        }
        assert_eq!(
            find_compiler(SourceLanguage::C, &[bundled.clone(), system]),
            Some(bundled.join(format!("gcc{}", env::consts::EXE_SUFFIX)))
        );
    }
}
