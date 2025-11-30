//
//  C2PA.swift
//

import C2PAC
import Foundation

public enum C2PA {

    public static func readFile(
        at url: URL,
    ) throws -> String {
        try stringFromC(
            c2pa_read_file(url.path, nil)
        )
    }
}
