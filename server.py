#!/usr/bin/env python3
"""
簡単なHTTPSサーバー（マイクアクセス用）
使用方法: python3 server.py
"""

import http.server
import ssl
import socketserver
import os

PORT = 8443

# 自己署名証明書を作成（開発用）
def create_self_signed_cert():
    try:
        import subprocess
        # OpenSSLで自己署名証明書を作成
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:4096', '-keyout', 'key.pem', 
            '-out', 'cert.pem', '-days', '365', '-nodes', '-subj', 
            '/C=JP/ST=Tokyo/L=Tokyo/O=Dev/CN=localhost'
        ], check=True)
        print("自己署名証明書を作成しました")
        return True
    except:
        print("OpenSSLが見つかりません。HTTPで起動します（マイクアクセスが制限される可能性があります）")
        return False

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS対応
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == "__main__":
    handler = MyHTTPRequestHandler
    
    # 証明書ファイルが存在するかチェック
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        use_https = True
    else:
        use_https = create_self_signed_cert()
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        if use_https and os.path.exists('cert.pem') and os.path.exists('key.pem'):
            # HTTPS設定
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain('cert.pem', 'key.pem')
            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
            print(f"HTTPSサーバーを起動しました: https://localhost:{PORT}")
            print("ブラウザで証明書の警告が出た場合は「詳細設定」→「localhost に進む」を選択してください")
        else:
            print(f"HTTPサーバーを起動しました: http://localhost:{PORT}")
            print("注意: HTTPではマイクアクセスが制限される場合があります")
        
        print("サーバーを停止するには Ctrl+C を押してください")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました")