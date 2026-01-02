# Real-Time Virtual Coding Assistant (RTVCA) for Visual Studio Code

## Overview
The **Real-Time Virtual Coding Assistant (RTVCA)** is a Visual Studio Code extension that enhances your coding experience by providing real-time code analysis, error detection, automated fix suggestions, autopilot code generation, and usage statistics. RTVCA supports Python and JavaScript, connecting to a backend server to deliver intelligent coding assistance directly in your VS Code sidebar.

**Key Features**:
- **Real-Time Code Analysis**: Detects errors as you type, with detailed error messages.
- **Fix Suggestions**: Offers one-click fixes for identified errors.
- **Autopilot Code Generation**: Generates code based on `# autopilot` (Python) or `// autopilot` (JavaScript) comments.
- **Usage Statistics**: Tracks fix requests and autopilot usage with a visual bar chart.
- **Sleek UI**: A modern, intuitive sidebar interface styled for clarity and ease of use.

## Prerequisites
- **Visual Studio Code**: Version 1.85 or later.
- **Node.js**: Version 16 or later (for extension development and backend dependencies).
- **Python**: Version 3.8 or later (for the backend server).
- **Backend Server**: The RTVCA Flask-SocketIO server must be running at `http://localhost:5000`.
- **Supported Languages**: Python (`.py`) and JavaScript (`.js`) files.

## Installation
1. **Install the Extension**:
   - Open VS Code.
   - Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS).
   - Search for **RTVC Assistant**.
   - Click **Install**.
   - Alternatively, if building locally:
     - Clone the repository to `/home/user/projects/rtvc-vscode`.
     - Run:
       ```bash
       cd /home/user/projects/rtvc-vscode
       npm install
       npm run compile
       ```
     - Open VS Code in the project folder and press `F5` to run the extension in debug mode.

2. **Set Up the Backend Server**:
   - Navigate to the backend project directory:
     ```bash
     cd /home/user/projects/rtvc-backend
     ```
   - Install dependencies (assuming a `requirements.txt` exists):
     ```bash
     pip install -r requirements.txt
     ```
   - Start the server:
     ```bash
     python app.py
     ```
   - Verify the server is running:
     - Open a browser and navigate to `http://localhost:5000`.
     - Expect a confirmation message (e.g., "RTVCA Backend Running").

3. **Verify Installation**:
   - In VS Code, open the RTVCA sidebar:
     - Click the RTVCA icon in the Activity Bar (or `View > Open View > RTVC Assistant`).
   - Expect a sidebar with a green “● Connected to RTVCA” status if the backend is running.

## Usage
The RTVCA extension operates through a sidebar panel in VS Code, providing real-time feedback and tools for coding. Below are instructions for each feature.

### 1. Opening the RTVCA Sidebar
- Click the RTVCA icon in the Activity Bar (left sidebar).
- Alternatively, use the Command Palette:
  - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
  - Type and select `RTVC Assistant: Show Panel`.
- The sidebar displays:
  - **Status**: Connection status (green dot for connected, red for disconnected).
  - **Errors**: List of detected code errors.
  - **Fixes**: Suggested fixes for errors.
  - **Autopilot**: Options for generating code based on autopilot comments.
  - **Statistics**: Bar chart of fix requests and autopilot usage.

### 2. Real-Time Code Analysis
- Open a Python (`.py`) or JavaScript (`.js`) file in the VS Code editor.
- As you type, RTVCA analyzes the code and sends it to the backend server.
- Errors appear in the **Errors** section of the sidebar, including:
  - Error type (e.g., `ReferenceError` for JavaScript, `NameError` for Python).
  - Line and column numbers.
  - Detailed message (e.g., “z is not defined”).
- **Example** (Python):
  ```python
  def test():
      print(z)  # Undefined variable
  ```
  - **Expect**: The Errors section shows:
    ```
    NameError (Line 2, Col 10)
    name 'z' is not defined
    [Request Fix]
    ```
- **Example** (JavaScript):
  ```javascript
  function test() {
      console.log(z); // Undefined variable
  }
  ```
  - **Expect**: The Errors section shows:
    ```
    ReferenceError (Line 2, Col 15)
    z is not defined
    [Request Fix]
    ```

### 3. Fix Suggestions
- For each error in the **Errors** section, click the **Request Fix** button.
- The backend processes the error and returns a suggested fix.
- The fix appears in the **Fixes** section with an **Apply Fix** button.
- **Example** (Python):
  - For the above error, click **Request Fix**.
  - **Expect**: The Fixes section shows:
    ```plaintext
    Fix for name 'z' is not defined
    z = 0
    def test():
        print(z)
    [Apply Fix]
    ```
  - Click **Apply Fix** to update the editor with the fixed code.
- **Example** (JavaScript):
  - For the above error, click **Request Fix**.
  - **Expect**: The Fixes section shows:
    ```plaintext
    Fix for z is not defined
    let z = 0;
    function test() {
        console.log(z);
    }
    [Apply Fix]
    ```
  - Click **Apply Fix** to update the editor.
- The **Statistics** chart updates, incrementing the “Request Fix” count.

### 4. Autopilot Code Generation
- Add an autopilot comment in your code to trigger code generation:
  - Python: `# autopilot <instruction>`
  - JavaScript: `// autopilot <instruction>`
- **Example** (Python):
  ```python
  # autopilot create function greet
  ```
- **Example** (JavaScript):
  ```javascript
  // autopilot create function greet
  ```
- The **Autopilot** section in the sidebar lists the instruction with a **Run Autopilot** button.
- Click **Run Autopilot** to send the instruction to the backend.
- The backend generates code and updates the editor.
- **Expect** (Python):
  ```python
  def greet():
      pass
  ```
- **Expect** (JavaScript):
  ```javascript
  function greet() {}
  ```
- The **Statistics** chart updates, incrementing the “Autopilot” count.

### 5. Usage Statistics
- The **Statistics** section displays a bar chart tracking:
  - **Request Fix**: Number of fix requests (initially 2, based on prior usage).
  - **Autopilot**: Number of autopilot runs (initially 4, based on prior usage).
- The chart updates automatically after each fix request or autopilot action.
- **Example**:
  - After one fix request, the chart shows `Request Fix: 3`.
  - After one autopilot run, the chart shows `Autopilot: 5`.

### 6. Connection Status
- The **Status** section shows:
  - Green dot and “Connected to RTVCA” when the backend is running.
  - Red dot and “Disconnected” with a **Reconnect** button if the backend is down.
- Click **Reconnect** to attempt reconnection to `http://localhost:5000`.
- **Expect**: Status updates to green if the server is available.

## Configuration
No additional configuration is required in VS Code, as the extension communicates directly with the backend at `http://localhost:5000`. Ensure the backend server is running before using the extension.

To customize the backend (e.g., change the port or add language support):
- Edit `/home/user/projects/rtvc-backend/app.py`.
- Update the Socket.IO server configuration or ANTLR grammars (`Python.g4`, `JavaScriptLexer.g4`).
- Restart the server:
  ```bash
  python app.py
  ```

## Troubleshooting
Below are common issues and solutions.

### Extension Not Loading
- **Symptom**: RTVCA icon or sidebar doesn’t appear.
- **Solution**:
  - Verify the extension is installed: `Extensions > RTVC Assistant`.
  - Reload VS Code: `Ctrl+Shift+P > Developer: Reload Window`.
  - Check the Output panel:
    - `View > Output`, select “RTVC Assistant” from the dropdown.
    - Look for errors (e.g., “Failed to load webview”).
  - Reinstall the extension via the Marketplace.
  - If built locally, ensure:
    ```bash
    cd /home/user/projects/rtvc-vscode
    npm install
    npm run compile
    ```

### Backend Not Connecting
- **Symptom**: Red dot and “Disconnected” status.
- **Solution**:
  - Ensure the backend is running:
    ```bash
    cd /home/user/projects/rtvc-backend
    python app.py
    ```
  - Test the server:
    ```bash
    curl http://localhost:5000
    ```
  - Check backend logs:
    ```bash
    tail -f /home/user/projects/rtvc-backend/app.log
    ```
  - Click **Reconnect** in the sidebar.
  - Verify firewall settings allow connections to `localhost:5000`.

### Errors Not Detected
- **Symptom**: No errors appear in the sidebar for invalid code.
- **Solution**:
  - Ensure the file is a supported type (`.py` or `.js`).
  - Check the Output panel for errors:
    - Look for “Emitting check_code” or Socket.IO failures.
  - Verify the backend supports the language:
    - Add debug logs to `app.py`:
      ```python
      @socketio.on('check_code')
      def handle_check_code(data):
          print(f"Check code: language={data['language']}, code_length={len(data['code'])}")
          # Existing logic
      ```
  - Restart the backend and reload VS Code.

### Fix or Autopilot Not Working
- **Symptom**: Clicking **Request Fix** or **Run Autopilot** has no effect.
- **Solution**:
  - Check the Output panel for Socket.IO errors (e.g., “Socket not connected”).
  - Verify the backend handles `fix_code` and `autopilot_code` events:
    - Add logs in `app.py`:
      ```python
      @socketio.on('fix_code')
      def handle_fix_code(data):
          print(f"Fix code: error={data['error']}")
          # Existing logic
      ```
  - Ensure the code contains valid autopilot comments (e.g., `# autopilot create function greet`).
  - Reload the sidebar: `Ctrl+Shift+P > RTVC Assistant: Show Panel`.

### Statistics Chart Not Updating
- **Symptom**: Bar chart doesn’t reflect new fix or autopilot actions.
- **Solution**:
  - Check the Output panel for chart-related errors.
  - Verify Chart.js is loaded in the extension’s webview code:
    - Ensure `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`.
  - Reload the sidebar.

### Performance Issues
- **Symptom**: Sidebar is slow or unresponsive.
- **Solution**:
  - Debounce code analysis requests:
    - In the extension’s JavaScript, ensure a 500ms delay:
      ```javascript
      let lastCheck = 0;
      function checkCode() {
          if (Date.now() - lastCheck < 500) return;
          lastCheck = Date.now();
          // Socket.IO emit logic
      }
      ```
  - Optimize backend performance:
    - Check `app.py` for inefficient parsing (e.g., ANTLR grammar issues).
  - Reduce chart updates:
    - Update the chart only on stat changes.

## Frequently Asked Questions
**Q: Can I use RTVCA with other languages?**
- A: Currently, RTVCA supports Python and JavaScript. To add languages, update the backend’s ANTLR grammars and modify the extension’s language detection.

**Q: How do I persist usage statistics?**
- A: Statistics are stored in VS Code’s workspace state. To reset, uninstall and reinstall the extension.

**Q: What if the backend server is on a different port?**
- A: Update the extension’s Socket.IO URL in the JavaScript code (e.g., `http://localhost:3000`) and rebuild:
  ```bash
  npm run compile
  ```

## Support
For issues not covered in the troubleshooting section:
- Check the project repository for updates: `/home/user/projects/rtvc-backend`.
- Submit a bug report via the VS Code extension’s feedback channel:
  - `Extensions > RTVC Assistant > ... > Report Issue`.
- Contact the developer for backend-related issues.

## License
The RTVCA extension is licensed under the MIT License. See the project repository for details.

---

**Happy Coding with RTVCA!** 🚀