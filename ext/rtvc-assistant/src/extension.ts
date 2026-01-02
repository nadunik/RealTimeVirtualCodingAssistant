import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RTVCWebviewProvider } from './webview/webview';

export function activate(context: vscode.ExtensionContext) {
    console.log('RTVC Assistant is now active!');

    const provider = new RTVCWebviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('rtvcAssistant.view', provider)
    );

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
    } catch (e:any) {
        console.error('Error reading stats.json:', e.message);
        stats = { requestFixCount: 0, autopilotCount: 0 };
    }

    

    // Send stats and docs to WebView
    console.log('Sending stats to WebView:', stats);
    provider.sendMessageToWebview({
        command: 'updateStats',
        stats
    });


    let debounceTimeout: NodeJS.Timeout | null = null;
    const checkCode = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('No active editor for checkCode');
            return;
        }
        const document = editor.document;
        const language = document.languageId;
        if (language !== 'python' && language !== 'javascript') return;

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
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(checkCode, 500);
    });

    vscode.window.onDidChangeActiveTextEditor(checkCode);

    console.log('Registering command: rtvcAssistant.checkCode');
    context.subscriptions.push(
        vscode.commands.registerCommand('rtvcAssistant.checkCode', checkCode)
    );

    console.log('Registering command: rtvcAssistant.requestFix');
    context.subscriptions.push(
        vscode.commands.registerCommand('rtvcAssistant.requestFix', (error) => {
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
        })
    );

    console.log('Registering command: rtvcAssistant.runAutopilot');
    context.subscriptions.push(
        vscode.commands.registerCommand('rtvcAssistant.runAutopilot', (instruction, line) => {
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
        })
    );

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
            const diagnostics: vscode.Diagnostic[] = message.errors.map((error: any) => {
                const line = (error.line || 1) - 1;
                const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);
                return new vscode.Diagnostic(
                    range,
                    error.message,
                    error.type === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
                );
            });
            diagnosticCollection.set(editor.document.uri, diagnostics);
        } else if (message.command === 'applyFix') {
            console.log('Applying fix:', message.code);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.edit((editBuilder) => {
                    editBuilder.replace(
                        new vscode.Range(0, 0, editor.document.lineCount, 0),
                        message.code
                    );
                });
            }
        } else if (message.command === 'incrementStat') {
            console.log('Incrementing stat:', message.stat);
            if (message.stat === 'requestFix') {
                stats.requestFixCount += 1;
            } else if (message.stat === 'autopilot') {
                stats.autopilotCount += 1;
            }
            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
            console.log('Updated stats:', stats);
            provider.sendMessageToWebview({
                command: 'updateStats',
                stats
            });
        } else if (message.command === 'openUrl') {
            console.log('Opening URL:', message.url);
            vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
    });
}

export function deactivate() {}


