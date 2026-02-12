package com.zcam1sdk

import android.util.Base64
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.junit.MockitoJUnitRunner
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * Unit tests for Android signing functionality.
 *
 * Note: These tests verify the signing algorithm and format,
 * but cannot test the actual Android KeyStore integration
 * (that requires instrumented tests on a real device).
 */
@RunWith(MockitoJUnitRunner::class)
class SigningTest {

    /**
     * Test that we can generate an EC key pair and sign data.
     * This validates the signing algorithm works correctly.
     */
    @Test
    fun testECDSASignatureFormat() {
        // Generate an EC key pair (same type as hardware-backed keys)
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        keyPairGenerator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair: KeyPair = keyPairGenerator.generateKeyPair()

        // Sign some test data
        val testData = "test data to sign"
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyPair.private)
        signature.update(testData.toByteArray(Charsets.UTF_8))
        val signatureBytes = signature.sign()

        // Verify signature is not empty
        assertTrue("Signature should not be empty", signatureBytes.isNotEmpty())

        // Verify signature is valid DER format (starts with 0x30)
        assertEquals("DER signature should start with SEQUENCE tag", 0x30.toByte(), signatureBytes[0])

        // Verify we can verify the signature
        val verifySignature = Signature.getInstance("SHA256withECDSA")
        verifySignature.initVerify(keyPair.public)
        verifySignature.update(testData.toByteArray(Charsets.UTF_8))
        assertTrue("Signature should verify correctly", verifySignature.verify(signatureBytes))
    }

    /**
     * Test that different data produces different signatures.
     */
    @Test
    fun testDifferentDataProducesDifferentSignatures() {
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        keyPairGenerator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair: KeyPair = keyPairGenerator.generateKeyPair()

        val signature = Signature.getInstance("SHA256withECDSA")

        // Sign first data
        signature.initSign(keyPair.private)
        signature.update("data 1".toByteArray(Charsets.UTF_8))
        val sig1 = signature.sign()

        // Sign second data
        signature.initSign(keyPair.private)
        signature.update("data 2".toByteArray(Charsets.UTF_8))
        val sig2 = signature.sign()

        // Signatures should be different
        assertFalse("Different data should produce different signatures", sig1.contentEquals(sig2))
    }

    /**
     * Test that signature verification fails with wrong data.
     */
    @Test
    fun testSignatureVerificationFailsWithWrongData() {
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        keyPairGenerator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair: KeyPair = keyPairGenerator.generateKeyPair()

        // Sign original data
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyPair.private)
        signature.update("original data".toByteArray(Charsets.UTF_8))
        val signatureBytes = signature.sign()

        // Try to verify with different data
        val verifySignature = Signature.getInstance("SHA256withECDSA")
        verifySignature.initVerify(keyPair.public)
        verifySignature.update("different data".toByteArray(Charsets.UTF_8))
        assertFalse("Signature should not verify with different data", verifySignature.verify(signatureBytes))
    }

    /**
     * Test that UTF-8 encoding is handled correctly for various character sets.
     */
    @Test
    fun testUTF8EncodingHandling() {
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        keyPairGenerator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair: KeyPair = keyPairGenerator.generateKeyPair()

        // Test with various character sets
        val testStrings = listOf(
            "simple ASCII",
            "émojis: 📱🔐",
            "中文字符",
            "mixed: Hello 世界! 🌍"
        )

        for (testData in testStrings) {
            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(keyPair.private)
            signature.update(testData.toByteArray(Charsets.UTF_8))
            val signatureBytes = signature.sign()

            // Verify signature
            val verifySignature = Signature.getInstance("SHA256withECDSA")
            verifySignature.initVerify(keyPair.public)
            verifySignature.update(testData.toByteArray(Charsets.UTF_8))
            assertTrue("Signature should verify for: $testData", verifySignature.verify(signatureBytes))
        }
    }

    /**
     * Test the message format used by generateAppAttestAssertion.
     * Format: base64(dataHash) + "|" + base64(sha256(metadata))
     */
    @Test
    fun testMessageFormatSigning() {
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        keyPairGenerator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair: KeyPair = keyPairGenerator.generateKeyPair()

        // Simulate the message format from generateAppAttestAssertion
        val dataHashBase64 = "dGVzdERhdGFIYXNo" // base64("testDataHash")
        val metadataHashBase64 = "bWV0YWRhdGFIYXNo" // base64("metadataHash")
        val message = "$dataHashBase64|$metadataHashBase64"

        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyPair.private)
        signature.update(message.toByteArray(Charsets.UTF_8))
        val signatureBytes = signature.sign()

        // Verify signature
        val verifySignature = Signature.getInstance("SHA256withECDSA")
        verifySignature.initVerify(keyPair.public)
        verifySignature.update(message.toByteArray(Charsets.UTF_8))
        assertTrue("Signature should verify for message format", verifySignature.verify(signatureBytes))
    }
}
