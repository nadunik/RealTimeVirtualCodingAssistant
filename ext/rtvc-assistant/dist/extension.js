/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RTVCWebviewProvider = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(3);
const fs_1 = __webpack_require__(2);
class RTVCWebviewProvider {
    constructor(extensionUri) {
        this._callbacks = [];
        this._extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
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
    sendMessageToWebview(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    onDidReceiveMessage(callback) {
        this._callbacks.push(callback);
    }
    _getHtmlForWebview(webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'webview.html');
        let html = (0, fs_1.readFileSync)(htmlPath, 'utf-8');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'webview.js'));
        const socketIoUri = webview.asWebviewUri(vscode.Uri.parse('https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js'));
        html = html.replace('${socketIoUri}', socketIoUri.toString());
        html = html.replace('${scriptUri}', scriptUri.toString());
        return html;
    }
}
exports.RTVCWebviewProvider = RTVCWebviewProvider;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(2);
const path = __webpack_require__(3);
const webview_1 = __webpack_require__(4);
function activate(context) {
    console.log('RTVC Assistant is now active!');
    const provider = new webview_1.RTVCWebviewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('rtvcAssistant.view', provider));
    // Initialize stats.json if it doesn't exist
    const statsPath = path.join(context.globalStorageUri.fsPath, 'stats.json');
    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
        fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    }
    if (!fs.existsSync(statsPath)) {
        fs.writeFileSync(statsPath, JSON.stringify({ requestFixCount: 0, autopilotCount: 0 }, null, 2));
    }
    // Read initial stats
    let stats;
    try {
        stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        console.log('Initial stats:', stats);
    }
    catch (e) {
        console.error('Error reading stats.json:', e.message);
        stats = { requestFixCount: 0, autopilotCount: 0 };
    }
    // Send stats and docs to WebView
    console.log('Sending stats to WebView:', stats);
    provider.sendMessageToWebview({
        command: 'updateStats',
        stats
    });
    let debounceTimeout = null;
    const checkCode = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('No active editor for checkCode');
            return;
        }
        const document = editor.document;
        const language = document.languageId;
        if (language !== 'python' && language !== 'javascript')
            return;
        const code = document.getText();
        if (code.trim()) {
            console.log('Sending checkCode to WebView:', { language, codeLength: code.length });
            provider.sendMessageToWebview({
                command: 'checkCode',
                code,
                language
            });
        }
    };
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (debounceTimeout)
            clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(checkCode, 500);
    });
    vscode.window.onDidChangeActiveTextEditor(checkCode);
    console.log('Registering command: rtvcAssistant.checkCode');
    context.subscriptions.push(vscode.commands.registerCommand('rtvcAssistant.checkCode', checkCode));
    console.log('Registering command: rtvcAssistant.requestFix');
    context.subscriptions.push(vscode.commands.registerCommand('rtvcAssistant.requestFix', (error) => {
        console.log('requestFix command triggered:', error);
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('No active editor for requestFix');
            return;
        }
        provider.sendMessageToWebview({
            command: 'requestFix',
            code: editor.document.getText(),
            error
        });
    }));
    console.log('Registering command: rtvcAssistant.runAutopilot');
    context.subscriptions.push(vscode.commands.registerCommand('rtvcAssistant.runAutopilot', (instruction, line) => {
        console.log('runAutopilot command triggered:', { instruction, line });
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('No active editor for runAutopilot');
            return;
        }
        provider.sendMessageToWebview({
            command: 'runAutopilot',
            instruction,
            line,
            code: editor.document.getText(),
            language: editor.document.languageId
        });
    }));
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('rtvcAssistant');
    context.subscriptions.push(diagnosticCollection);
    provider.onDidReceiveMessage((message) => {
        console.log('Extension received WebView message:', message);
        if (message.command === 'updateDiagnostics') {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                console.log('No active editor for diagnostics');
                return;
            }
            const diagnostics = message.errors.map((error) => {
                const line = (error.line || 1) - 1;
                const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);
                return new vscode.Diagnostic(range, error.message, error.type === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
            });
            diagnosticCollection.set(editor.document.uri, diagnostics);
        }
        else if (message.command === 'applyFix') {
            console.log('Applying fix:', message.code);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.edit((editBuilder) => {
                    editBuilder.replace(new vscode.Range(0, 0, editor.document.lineCount, 0), message.code);
                });
            }
        }
        else if (message.command === 'incrementStat') {
            console.log('Incrementing stat:', message.stat);
            if (message.stat === 'requestFix') {
                stats.requestFixCount += 1;
            }
            else if (message.stat === 'autopilot') {
                stats.autopilotCount += 1;
            }
            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
            console.log('Updated stats:', stats);
            provider.sendMessageToWebview({
                command: 'updateStats',
                stats
            });
        }
        else if (message.command === 'openUrl') {
            console.log('Opening URL:', message.url);
            vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
    });
}
function deactivate() { }

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map