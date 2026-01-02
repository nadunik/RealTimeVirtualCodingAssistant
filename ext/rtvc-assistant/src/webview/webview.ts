
import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync } from 'fs';

export class RTVCWebviewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _callbacks: ((message: any) => void)[] = [];

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview'),
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message) => {
            this._callbacks.forEach((callback) => callback(message));
        });
    }

    public sendMessageToWebview(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public onDidReceiveMessage(callback: (message: any) => void) {
        this._callbacks.push(callback);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'webview.html');
        let html = readFileSync(htmlPath, 'utf-8');

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'webview.js')
        );
        const socketIoUri = webview.asWebviewUri(
            vscode.Uri.parse('https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js')
        );

        html = html.replace('${socketIoUri}', socketIoUri.toString());
        html = html.replace('${scriptUri}', scriptUri.toString());

        return html;
    }
}
