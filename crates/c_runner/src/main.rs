fn main() {
    let mut arguments = std::env::args_os().skip(1);
    let Some(source) = arguments.next() else {
        eprintln!("用法：lec-run <C/C++ 源文件>");
        std::process::exit(2);
    };
    if arguments.next().is_some() {
        eprintln!("每次只能运行一个 C/C++ 源文件。");
        std::process::exit(2);
    }
    let code = match c_runner::run_file(std::path::Path::new(&source)) {
        Ok(code) => code,
        Err(error) => {
            eprintln!("{error}");
            1
        }
    };
    std::process::exit(code);
}
