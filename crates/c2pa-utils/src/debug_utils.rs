#[allow(dead_code)]
pub fn install_panic_hook() {
    use std::sync::OnceLock;
    static INSTALLED: OnceLock<()> = OnceLock::new();
    INSTALLED.get_or_init(|| {
        std::panic::set_hook(Box::new(|info| {
            let location = info
                .location()
                .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                .unwrap_or_else(|| "<unknown>".to_string());
            let msg = info
                .payload()
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| info.payload().downcast_ref::<String>().map(|s| s.as_str()))
                .unwrap_or("<non-string panic>");
            let backtrace = std::backtrace::Backtrace::force_capture();
            let full = format!("[ZCAM1_PANIC] {location}: {msg}\n{backtrace}");

            log_error("ZCAM1", &full);
        }));
    });
}

#[cfg(target_os = "android")]
fn log_error(tag: &str, msg: &str) {
    use std::ffi::CString;
    #[allow(non_camel_case_types)]
    extern "C" {
        fn __android_log_write(
            prio: std::ffi::c_int,
            tag: *const std::ffi::c_char,
            text: *const std::ffi::c_char,
        ) -> std::ffi::c_int;
    }
    const ANDROID_LOG_ERROR: std::ffi::c_int = 6;
    // Logcat truncates lines >4000 chars; chunk the output.
    let tag_c = CString::new(tag).unwrap_or_default();
    for chunk in msg
        .as_bytes()
        .chunks(3900)
        .map(|c| String::from_utf8_lossy(c).into_owned())
    {
        if let Ok(c) = CString::new(chunk) {
            unsafe { __android_log_write(ANDROID_LOG_ERROR, tag_c.as_ptr(), c.as_ptr()) };
        }
    }
}

#[cfg(not(target_os = "android"))]
fn log_error(_tag: &str, msg: &str) {
    eprintln!("{msg}");
}
