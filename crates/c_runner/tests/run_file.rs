use std::{
    fs,
    io::Write,
    path::PathBuf,
    process::{Command, Output, Stdio},
    sync::atomic::{AtomicU64, Ordering},
};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        static SEQUENCE: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "lec-run-test-{}-{}",
            std::process::id(),
            SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).expect("create test directory");
        Self(path)
    }

    fn source(&self, name: &str, content: &str) -> PathBuf {
        let path = self.0.join(name);
        fs::write(&path, content).expect("write source");
        path
    }

    fn run(&self, name: &str, input: &[u8]) -> Output {
        let mut child = Command::new(env!("CARGO_BIN_EXE_lec-run"))
            .arg(self.0.join(name))
            .current_dir(std::env::temp_dir())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("start runner");
        child
            .stdin
            .take()
            .expect("piped stdin")
            .write_all(input)
            .expect("write program input");
        child.wait_with_output().expect("wait for runner")
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).expect("clean up fixture");
    }
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn assert_success(output: &Output) {
    assert!(
        output.status.success(),
        "stdout: {}\nstderr: {}",
        stdout(output),
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn c_reads_stdin_and_relative_files_from_the_source_directory() {
    let fixture = Fixture::new();
    fs::write(fixture.0.join("input.txt"), "17").expect("write input file");
    fixture.source(
        "main.c",
        r#"#include <stdio.h>
int main(void) {
    int input, value;
    FILE *file = fopen("input.txt", "r");
    if (!file || fscanf(file, "%d", &value) != 1) return 2;
    fclose(file);
    if (scanf("%d", &input) != 1) return 3;
    printf("RESULT=%d\n", value + input);
    return 0;
}
"#,
    );
    let output = fixture.run("main.c", b"25\n");
    assert_success(&output);
    assert!(stdout(&output).contains("RESULT=42"));
}

#[test]
fn cpp_links_its_standard_library() {
    let fixture = Fixture::new();
    fixture.source(
        "main.cpp",
        r#"#include <iostream>
#include <vector>
int main() {
    const std::vector<int> values{19, 23};
    std::cout << "RESULT=" << values[0] + values[1] << std::endl;
}
"#,
    );
    let output = fixture.run("main.cpp", b"");
    assert_success(&output);
    assert!(stdout(&output).contains("RESULT=42"));
}

#[test]
fn source_paths_are_literal_arguments() {
    let fixture = Fixture::new();
    let name = "中文 $(touch injected) & 'quoted'.c";
    fixture.source(
        name,
        "#include <stdio.h>\nint main(void) { puts(\"PATH_OK\"); }",
    );
    let output = fixture.run(name, b"");
    assert_success(&output);
    assert!(stdout(&output).contains("PATH_OK"));
    assert!(!fixture.0.join("injected").exists());
}

#[test]
fn compilation_failure_does_not_run_the_previous_program() {
    let fixture = Fixture::new();
    fixture.source(
        "main.c",
        "#include <stdio.h>\nint main(void) { puts(\"PROGRAM_RAN\"); }",
    );
    let first = fixture.run("main.c", b"");
    assert_success(&first);
    assert!(stdout(&first).contains("PROGRAM_RAN"));
    fixture.source("main.c", "int main(void) { THIS_IS_NOT_C; }");
    let failed = fixture.run("main.c", b"");
    assert!(!failed.status.success());
    assert!(!stdout(&failed).contains("PROGRAM_RAN"));
    assert!(String::from_utf8_lossy(&failed.stderr).contains("编译失败"));
}

#[test]
fn propagates_the_program_exit_code() {
    let fixture = Fixture::new();
    fixture.source("main.c", "int main(void) { return 7; }");
    let output = fixture.run("main.c", b"");
    assert_eq!(output.status.code(), Some(7));
    assert!(stdout(&output).contains("退出码：7"));
}

#[test]
fn reports_a_missing_compiler() {
    let fixture = Fixture::new();
    let source = fixture.source("main.c", "int main(void) { return 0; }");
    // 将运行器复制到独立目录，确保测试不受开发构建旁的内置工具链影响。
    let runner = fixture
        .0
        .join(format!("lec-run{}", std::env::consts::EXE_SUFFIX));
    fs::copy(env!("CARGO_BIN_EXE_lec-run"), &runner).expect("复制独立运行器");
    let output = Command::new(runner)
        .arg(source)
        .env("PATH", "")
        .output()
        .expect("start runner");
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("未找到 C/C++ 编译器"));
}

#[test]
fn compile_only_creates_a_program_without_running_it() {
    let fixture = Fixture::new();
    fixture.source(
        "调试练习.c",
        "#include <stdio.h>\nint main(void) { FILE *file = fopen(\"executed.txt\", \"w\"); if (!file) return 1; fclose(file); return 0; }\n",
    );
    let program = fixture
        .0
        .join("调试 产物")
        .join(format!("program{}", std::env::consts::EXE_SUFFIX));
    let output = Command::new(env!("CARGO_BIN_EXE_lec-run"))
        .arg("--compile-only")
        .arg(fixture.0.join("调试练习.c"))
        .arg(&program)
        .current_dir(&fixture.0)
        .output()
        .expect("compile for debugging");
    assert_success(&output);
    assert!(program.is_file());
    assert!(!fixture.0.join("executed.txt").exists());
    assert!(!stdout(&output).contains("开始运行"));
}
