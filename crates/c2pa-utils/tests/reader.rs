use zcam1_c2pa_utils::read_file;

#[test]
fn test_reader() {
    // using common code.
    let json = read_file("./tests/fixtures/with_proof.jpg");

    println!("{json}");
}
