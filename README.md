# Real-Time Virtual Coding Assistant (RTVCA) for Visual Studio Code: Technical Documentation

## Introduction
The **Real-Time Virtual Coding Assistant (RTVCA)** is a Visual Studio Code extension that provides real-time code analysis, error detection, fix suggestions, autopilot code generation, and usage statistics for Python (`.py`) and JavaScript (`.js`) files. The extension communicates with a Flask-SocketIO backend server at `http://localhost:5000` to process code and deliver intelligent coding assistance via a webview-based sidebar.

This document details the extension’s architecture, implementation, dependencies, development setup, and deployment process for developers and maintainers.

## Features
- **Real-Time Code Analysis**: Detects errors in Python and JavaScript code as the user types, displaying error details (type, message, line, column) in the sidebar.
- **Fix Suggestions**: Offers automated fixes for detected errors, with options to request and apply fixes.
- **Autopilot Code Generation**: Generates code based on `# autopilot` (Python) or `// autopilot` (JavaScript) comments.
- **Usage Statistics**: Tracks fix requests and autopilot runs, visualized in a Chart.js bar chart.
- **Connection Status**: Displays backend connection status (green/red dot) with a reconnect option.

## Architecture
The RTVCA extension follows a client-server architecture:
- **Client (VS Code Extension)**:
  - Built with TypeScript and VS Code APIs.
  - Uses a webview panel for the sidebar UI, styled with Tailwind CSS and Chart.js for statistics.
  - Communicates with the backend via Socket.IO.
- **Server (Backend)**:
  - A Flask-SocketIO server (`app.py`) running at `http://localhost:5000`.
  - Uses ANTLR grammars (`Python.g4`, `JavaScriptLexer.g4`) for parsing Python and JavaScript code.
  - Handles events for code analysis (`check_code`), fix suggestions (`fix_code`), and autopilot generation (`autopilot_code`).

### Data Flow
1. **Code Input**:
   - The extension listens for editor changes using VS Code’s `TextDocumentChangeEvent`.
   - Extracts the active file’s content and language (Python or JavaScript).
2. **Backend Communication**:
   - Sends code to the backend via Socket.IO (`check_code` event).
   - Receives error details (`code_errors`), fixes (`code_fix`), or autopilot results (`autopilot_result`).
3. **UI Update**:
   - Renders errors, fixes, autopilot instructions, and stats in the webview.
   - Updates the Chart.js bar chart with `requestFixCount` and `autopilotCount`.
4. **Code Modification**:
   - Applies fixes or autopilot-generated code to the editor using VS Code’s `TextEdit` API.

## Implementation Details
### Extension Structure
The extension is located at `/home/user/projects/rtvc-vscode` with the following key files:

- **`package.json`**:
  - Defines metadata, commands, and activation events.
  - Specifies dependencies (e.g., `socket.io-client`, `chart.js`).
  - Configures the sidebar view (`RTVCAssistantViewProvider`).

- **`src/extension.ts`**:
  - Main entry point for the extension.
  - Registers the webview provider and commands.
  - Initializes Socket.IO and editor listeners.

- **`src/webview/main.ts`**:
  - Manages the webview UI (HTML, CSS, JavaScript).
  - Handles Socket.IO events and updates the sidebar (status, errors, fixes, autopilot, stats).

- **`src/webview/index.html`**:
  - Defines the webview’s HTML structure, including Tailwind CSS and Chart.js.

- **`src/utils/socket.ts`**:
  - Encapsulates Socket.IO client logic for connecting to `http://localhost:5000`.

### Backend Structure
The backend is located at `/home/user/projects/rtvc-backend` with key files:

- **`app.py`**:
  - Flask-SocketIO server handling `check_code`, `fix_code`, and `autopilot_code` events.
  - Uses ANTLR for parsing Python and JavaScript code.

- **`requirements.txt`**:
  - Lists dependencies (e.g., `flask`, `flask-socketio`, `antlr4-python3-runtime`).

- **`Python.g4`, `JavaScriptLexer.g4`**:
  - ANTLR grammars for parsing Python and JavaScript code.

### Key Components
#### Webview UI
- **Technology**: HTML, Tailwind CSS, JavaScript, Chart.js.
- **Structure**:
  - **Status Section**: Displays connection status (green/red dot) and a “Reconnect” button.
  - **Errors Section**: Lists errors with “Request Fix” buttons.
  - **Fixes Section**: Shows suggested fixes with “Apply Fix” buttons.
  - **Autopilot Section**: Displays detected `# autopilot` or `// autopilot` instructions with “Run Autopilot” buttons.
  - **Statistics Section**: Renders a bar chart with `requestFixCount` (initially 2) and `autopilotCount` (initially 4).
- **Styling**: Uses Tailwind CSS classes (e.g., `bg-gray-800`, `text-red-500`) for a modern, VS Code-like aesthetic.

#### Socket.IO Communication
- **Client**: Uses `socket.io-client` to connect to `http://localhost:5000`.
- **Events**:
  - **`check_code`**: Sends code and language, receives `code_errors` with error details.
  - **`fix_code`**: Sends code and error, receives `code_fix` with a suggested fix.
  - **`autopilot_code`**: Sends instruction, line, language, and code, receives `autopilot_result` with generated code.
  - **Connection Events**: Handles `connect`, `connect_error`, `disconnect`.

#### Editor Integration
- **Listener**: Uses `vscode.workspace.onDidChangeTextDocument` to detect code changes.
- **Language Detection**:
  ```typescript
  const language = document.fileName.endsWith('.py') ? 'python' :
                   document.fileName.endsWith('.js') ? 'javascript' : 'unknown';
  ```
- **Code Application**: Applies fixes using `vscode.TextEdit` within a `WorkspaceEdit`.

#### Statistics
- **Storage**: Persists `requestFixCount` and `autopilotCount` in VS Code’s `Memento` API (`context.globalState`).
- **Chart**: Uses Chart.js to render a bar chart, updated on fix or autopilot actions.

### Performance Optimizations
- **Debouncing**: Limits `check_code` emissions to every 500ms:
  ```typescript
  let lastCheck = 0;
  function checkCode() {
      if (Date.now() - lastCheck < 500) return;
      lastCheck = Date.now();
      // Emit check_code
  }
  ```
- **Efficient Parsing**: Backend uses optimized ANTLR grammars to minimize parsing overhead.

## Dependencies
### Extension
- **Node.js**: v16 or later.
- **VS Code**: v1.85 or later.
- **NPM Packages** (defined in `package.json`):
  - `@types/vscode`: Type definitions for VS Code APIs.
  - `socket.io-client`: For backend communication.
  - `chart.js`: For rendering the statistics bar chart.
  - `tailwindcss`: For webview styling (included via CDN in `index.html`).
  - Development dependencies:
    - `typescript`: For compiling TypeScript.
    - `esbuild`: For bundling.
    - `vsce`: For packaging (if publishing to Marketplace).

### Backend
- **Python**: v3.8 or later.
- **Pip Packages** (defined in `requirements.txt`):
  - `flask`: Web framework.
  - `flask-socketio`: For real-time communication.
  - `antlr4-python3-runtime`: For parsing Python and JavaScript.
  - Other dependencies as needed (e.g., `python-socketio`).

## Development Setup
### Prerequisites
- **VS Code**: v1.85 or later.
- **Node.js**: v16 or later.
- **Python**: v3.8 or later.
- **Git**: For cloning repositories.

### Steps
1. **Clone Repositories**:
   ```bash
   mkdir -p /home/user/projects
   git clone <rtvc-vscode-repo> /home/user/projects/rtvc-vscode
   git clone <rtvc-backend-repo> /home/user/projects/rtvc-backend
   ```

2. **Set Up Extension**:
   ```bash
   cd /home/user/projects/rtvc-vscode
   npm install
   npm run compile
   ```
   - This installs dependencies and compiles TypeScript to JavaScript.

3. **Set Up Backend**:
   ```bash
   cd /home/user/projects/rtvc-backend
   pip install -r requirements.txt
   python app.py
   ```
   - Verify the server runs at `http://localhost:5000` (test with `curl http://localhost:5000`).

4. **Run Extension in Development**:
   - Open `/home/user/projects/rtvc-vscode` in VS Code.
   - Press `F5` to launch the extension in a debug instance.
   - Open the RTVCA sidebar (`View > Open View > RTVC Assistant`).
   - Expect a green “● Connected to RTVCA” status if the backend is running.

5. **Debugging**:
   - **Extension**: Use VS Code’s debugger (`F5`) with breakpoints in `src/extension.ts` or `src/webview/main.ts`.
   - **Webview**: Open the webview’s DevTools:
     - Right-click the sidebar > “Inspect” (requires `webview.developerTools: true` in `package.json`).
   - **Backend**: Add debug logs to `app.py`:
     ```python
     @socketio.on('check_code')
     def handle_check_code(data):
         print(f"Check code: language={data['language']}, code_length={len(data['code'])}")
         # Existing logic
     ```
   - Check logs: `tail -f /home/user/projects/rtvc-backend/app.log`.

## Deployment
### Publishing to VS Code Marketplace
1. **Package Extension**:
   ```bash
   cd /home/user/projects/rtvc-vscode
   npm run package
   ```
   - Generates a `.vsix` file (optional, for manual distribution).

2. **Publish**:
   - Install `vsce`:
     ```bash
     npm install -g vsce
     ```
   - Create a publisher account at `https://marketplace.visualstudio.com`.
   - Generate a Personal Access Token (PAT).
   - Publish:
     ```bash
     vsce publish --pat <your-pat>
     ```
   - The extension will be available as “RTVC Assistant” in the Marketplace.

### Local Deployment
- Build the extension:
  ```bash
  npm run compile
  ```
- Install locally by running the extension in a VS Code instance (`F5`).

## Testing
### Unit Tests
- Located in `/home/user/projects/rtvc-vscode/src/test`.
- Run:
  ```bash
  npm run test
  ```
- Tests cover:
  - Socket.IO event handling.
  - Webview rendering.
  - Editor integration.

### Manual Testing
1. **Setup**:
   - Start the backend: `python /home/user/projects/rtvc-backend/app.py`.
   - Run the extension: `F5` in VS Code.

2. **Test Cases**:
   - **Connection Status**:
     - Open the sidebar.
     - **Expect**: Green “● Connected to RTVCA” (or red with “Reconnect” if backend is down).
     - Stop the backend, click “Reconnect”.
     - **Expect**: Status updates to green after restarting the backend.
   - **Code Analysis**:
     - Open a Python file:
       ```python
       def test():
           print(z)  # Undefined variable
       ```
     - **Expect**: Errors section shows:
       ```
       NameError (Line 2, Col 10)
       name 'z' is not defined
       [Request Fix]
       ```
     - Open a JavaScript file:
       ```javascript
       function test() {
           console.log(z); // Undefined variable
       }
       ```
     - **Expect**: Errors section shows:
       ```
       ReferenceError (Line 2, Col 15)
       z is not defined
       [Request Fix]
       ```
   - **Fix Suggestions**:
     - Click “Request Fix” for the Python error.
     - **Expect**: Fixes section shows:
       ```plaintext
       Fix for name 'z' is not defined
       z = 0
       def test():
           print(z)
       [Apply Fix]
       ```
     - Click “Apply Fix”.
     - **Expect**: Editor updates with the fix, stats show `Request Fix: 3`.
   - **Autopilot**:
     - Add to a Python file:
       ```python
       # autopilot create function greet
       ```
     - **Expect**: Autopilot section shows:
       ```
       Line 1: create function greet
       [Run Autopilot]
       ```
     - Click “Run Autopilot”.
     - **Expect**: Editor updates to:
       ```python
       def greet():
           pass
       ```
     - Stats show `Autopilot: 5`.
   - **Statistics**:
     - Perform one fix and one autopilot action.
     - **Expect**: Chart updates with `Request Fix: 3`, `Autopilot: 5`.

3. **Logs**:
   - Check VS Code Output panel (“RTVC Assistant” channel) for:
     ```
     Emitting check_code: language=python, codeLength=35
     Received code_errors: {errors: [{type: "NameError", message: "name 'z' is not defined", line: 2, column: 10}]}
     ```
   - Check backend logs:
     ```bash
     tail -f /home/user/projects/rtvc-backend/app.log
     ```

## Troubleshooting
### Extension Fails to Load
- **Symptom**: Sidebar doesn’t appear.
- **Solution**:
  - Check Output panel (`View > Output > RTVC Assistant`) for errors.
  - Verify `package.json` activation events:
    ```json
    "activationEvents": ["onView:rtvcAssistant"]
    ```
  - Rebuild: `npm run compile`.

### Backend Connection Issues
- **Symptom**: Red “Disconnected” status.
- **Solution**:
  - Verify backend:
    ```bash
    curl http://localhost:5000
    ```
  - Check logs: `tail -f /home/user/projects/rtvc-backend/app.log`.
  - Ensure `socket.io-client` URL is `http://localhost:5000`.

### Errors Not Detected
- **Symptom**: No errors in sidebar for invalid code.
- **Solution**:
  - Verify file extension (`.py` or `.js`).
  - Add debug logs in `src/webview/main.ts`:
    ```typescript
    socket.on('code_errors', (data) => {
        console.log('Received code_errors:', data);
        // Existing logic
    });
    ```
  - Check backend grammar parsing in `app.py`.

### Chart Not Rendering
- **Symptom**: Statistics section is blank.
- **Solution**:
  - Verify Chart.js CDN in `index.html`:
    ```html
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    ```
  - Check console in webview DevTools for errors.

## Maintenance
### Adding Language Support
1. Update backend:
   - Add a new ANTLR grammar (e.g., `TypeScript.g4`).
   - Modify `app.py` to handle the new language:
     ```python
     if data['language'] == 'typescript':
         # Parse with TypeScript grammar
     ```
2. Update extension:
   - Modify language detection in `src/extension.ts`:
     ```typescript
     const language = document.fileName.endsWith('.py') ? 'python' :
                      document.fileName.endsWith('.js') ? 'javascript' :
                      document.fileName.endsWith('.ts') ? 'typescript' : 'unknown';
     ```

### Updating Statistics
- Add new metrics to `context.globalState` in `src/webview/main.ts`:
  ```typescript
  context.globalState.update('newMetric', 0);
  ```
- Update Chart.js dataset:
  ```javascript
  chart.data.datasets[0].data.push(newMetric);
  ```

## License
The RTVCA extension is licensed under the MIT License. See `/home/user/projects/rtvc-vscode/LICENSE` for details.

## Contact
For issues or contributions, contact the development team via the project repository at `/home/user/projects/rtvc-vscode`.

---

**Version**: 1.0.0  
**Last Updated**: April 28, 2025
