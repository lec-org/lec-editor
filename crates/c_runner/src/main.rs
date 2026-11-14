fn main() {
    let mut arguments = std::env::args_os().skip(1);
    let Some(first) = arguments.next() else {
        eprintln!("用法：lec-run <源文件> 或 lec-run --compile-only <源文件> <产物路径>");
        std::process::exit(2);
    };
    let result = if first == "--compile-only" {
        let (Some(source), Some(program), None) =
            (arguments.next(), arguments.next(), arguments.next())
        else {
            eprintln!("用法：lec-run --compile-only <源文件> <产物路径>");
            std::process::exit(2);
        };
        c_runner::compile_file(
            std::path::Path::new(&source),
            std::path::Path::new(&program),
        )
    } else {
        if arguments.next().is_some() {
            eprintln!("每次只能运行一个 C/C++ 源文件。");
            std::process::exit(2);
        }
        c_runner::run_file(std::path::Path::new(&first))
    };
    let code = match result {
        Ok(code) => code,
        Err(error) => {
            eprintln!("{error}");
            1
        }
    };
    std::process::exit(code);
}
