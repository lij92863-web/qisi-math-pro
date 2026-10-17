# Local TLS test fixture

Synthetic self-signed localhost certificate and disposable private key, generated only
for the HTTPS transport tests. These are public test data, not application credentials.
The certificate is trusted only by the injected loopback request in the test process;
it is never installed in any system or production trust store. No key logging is used.
