'''
from flask import Flask, render_template
from flask_socketio import SocketIO
import json
import tempfile
import os
import subprocess
import ast
import logging
from openai import OpenAI
import re

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize OpenAI client for OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="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",
)

def check_python_code(code):
    errors = []
    try:
        ast.parse(code)
    except SyntaxError as e:
        errors.append({
            'line': e.lineno,
            'column': e.offset,
            'type': 'SyntaxError',
            'message': str(e)
        })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as temp:
        temp.write(code)
        temp_file = temp.name

    try:
        result = subprocess.run(
            ['python', '-m', 'pylsp', '--check', temp_file],
            capture_output=True,
            text=True
        )
        if result.stdout:
            lsp_output = json.loads(result.stdout)
            for diagnostic in lsp_output.get('diagnostics', []):
                errors.append({
                    'line': diagnostic['range']['start']['line'] + 1,
                    'column': diagnostic['range']['start']['character'] + 1,
                    'type': diagnostic['severity'],
                    'message': diagnostic['message']
                })
    except Exception as e:
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'Error',
            'message': f'LSP error: {str(e)}'
        })

    try:
        result = subprocess.run(
            ['pylint', '--output-format=json', temp_file],
            capture_output=True,
            text=True
        )
        if result.stdout:
            pylint_output = json.loads(result.stdout)
            for issue in pylint_output:
                if issue['type'] in ['error', 'warning']:
                    message = issue['message']
                    if 'unused' in message.lower() or 'redefined' in message.lower() or 'unreachable' in message.lower():
                        errors.append({
                            'line': issue.get('line', 0),
                            'column': issue.get('column', 0),
                            'type': issue['type'].capitalize(),
                            'message': f"{message} ({issue['message-id']})"
                        })
    except Exception as e:
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'Error',
            'message': f'Pylint error: {str(e)}'
        })
    finally:
        os.unlink(temp_file)

    return errors if errors else [{'message': 'No errors found'}]

def check_javascript_code(code):
    errors = []
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as temp:
        temp.write(code)
        temp_file = temp.name

    try:
        jshint_cmd = ['node', 'check_js_jshint.js', temp_file]
        logger.debug(f"Running JSHint command: {' '.join(jshint_cmd)}")
        result = subprocess.run(
            jshint_cmd,
            capture_output=True,
            text=True
        )
        if result.stderr:
            logger.error(f"JSHint stderr: {result.stderr}")
            errors.append({
                'line': 0,
                'column': 0,
                'type': 'JSHintError',
                'message': f'JSHint stderr: {result.stderr}'
            })
        if result.stdout:
            try:
                jshint_errors = json.loads(result.stdout)
                errors.extend(jshint_errors)
            except json.JSONDecodeError as e:
                logger.error(f"JSHint JSON parse error: {str(e)}")
                errors.append({
                    'line': 0,
                    'column': 0,
                    'type': 'JSONError',
                    'message': f'Failed to parse JSHint output: {str(e)}'
                })
        if not errors and result.returncode != 0:
            errors.append({
                'line': 0,
                'column': 0,
                'type': 'JSHintError',
                'message': f'JSHint failed with exit code {result.returncode}'
            })
    except FileNotFoundError as e:
        logger.error(f"JSHint or Node.js not found: {str(e)}")
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'ConfigError',
            'message': 'JSHint or Node.js not found. Ensure JSHint is installed (npm install -g jshint) and Node.js is installed.'
        })
    except Exception as e:
        logger.error(f"Unexpected JSHint error: {str(e)}")
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'Error',
            'message': f'Unexpected JSHint error: {str(e)}'
        })
    finally:
        os.unlink(temp_file)

    return errors if errors else [{'message': 'No errors found'}]

def generate_autopilot_code(instruction, language, code):
    try:
        language_map = {'python': 'Python', 'javascript': 'JavaScript'}
        lang = language_map.get(language.lower(), 'Python')
        completion = client.chat.completions.create(
            model="deepseek/deepseek-r1:free",
            messages=[
                {
                    "role": "system",
                    "content": f"You are an expert {lang} coder. Generate {lang} code based on the user's instruction, considering the existing code for context. Provide only the code without explanations, formatted correctly for {lang}. Ensure the code is concise, integrates seamlessly with the existing code, and follows the instruction exactly."
                },
                {
                    "role": "user",
                    "content": f"**Existing Code**:\n```python\n{code}\n```\n**Instruction**: {instruction}"
                }
            ]
        )
        generated_code = completion.choices[0].message.content.strip()
        # Remove markdown code fences if present
        generated_code = re.sub(r'^```[\w]*\n|```$', '', generated_code, flags=re.MULTILINE)
        return {'success': True, 'code': generated_code}
    except Exception as e:
        logger.error(f"OpenRouter API error: {str(e)}")
        return {'success': False, 'error': f'Failed to generate code: {str(e)}'}

def get_code_fix(code, error):
    try:
        completion = client.chat.completions.create(
            model="deepseek/deepseek-r1:free",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert code debugger. Analyze the provided code and error, identify the problem, and suggest a fix. Provide a clear explanation and the corrected code."
                },
                {
                    "role": "user",
                    "content": f"**Code**:\n```python\n{code}\n```\n**Error**:\nLine {error['line']}, Col {error['column']}: {error['message']} ({error['type']})"
                }
            ]
        )
        fix_suggestion = completion.choices[0].message.content
        return {'success': True, 'fix': fix_suggestion}
    except Exception as e:
        logger.error(f"OpenRouter API error: {str(e)}")
        return {'success': False, 'error': f'Failed to fetch fix: {str(e)}'}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('check_code')
def handle_check_code(data):
    code = data.get('code', '')
    language = data.get('language', '').lower()
    errors = []

    if language == 'python':
        errors = check_python_code(code)
    elif language == 'javascript':
        errors = check_javascript_code(code)
    else:
        errors = [{'message': 'Unsupported language'}]

    socketio.emit('code_errors', {
        'errors': errors,
        'code': code
    })

@socketio.on('fix_code')
def handle_fix_code(data):
    code = data.get('code', '')
    error = data.get('error', {})
    fix_result = get_code_fix(code, error)
    socketio.emit('code_fix', {'error': error, 'fix_result': fix_result})

@socketio.on('autopilot_code')
def handle_autopilot_code(data):
    instruction = data.get('instruction', '')
    line = data.get('line', 0)
    language = data.get('language', '').lower()
    code = data.get('code', '')
    result = generate_autopilot_code(instruction, language, code)
    socketio.emit('autopilot_result', {
        'line': line,
        'result': result
    })

if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True)

'''

from flask import Flask, render_template
from flask_socketio import SocketIO
import json
import tempfile
import os
import subprocess
import ast
import logging
import socket
from openai import OpenAI
import re

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize OpenAI client for OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="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",
)

def find_free_port(start_port=5000, max_port=5010):
    """Find a free port starting from start_port."""
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise OSError("No free ports available in the specified range")

def check_python_code(code):
    errors = []
    try:
        ast.parse(code)
    except SyntaxError as e:
        errors.append({
            'line': e.lineno,
            'column': e.offset,
            'type': 'SyntaxError',
            'message': str(e)
        })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as temp:
        temp.write(code)
        temp_file = temp.name

    try:
        result = subprocess.run(
            ['python', '-m', 'pylsp', '--check', temp_file],
            capture_output=True,
            text=True
        )
        if result.stdout:
            lsp_output = json.loads(result.stdout)
            for diagnostic in lsp_output.get('diagnostics', []):
                errors.append({
                    'line': diagnostic['range']['start']['line'] + 1,
                    'column': diagnostic['range']['start']['character'] + 1,
                    'type': diagnostic['severity'],
                    'message': diagnostic['message']
                })
    except Exception as e:
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'Error',
            'message': f'LSP error: {str(e)}'
        })

    try:
        result = subprocess.run(
            ['pylint', '--output-format=json', temp_file],
            capture_output=True,
            text=True
        )
        if result.stdout:
            pylint_output = json.loads(result.stdout)
            for issue in pylint_output:
                if issue['type'] in ['error', 'warning']:
                    message = issue['message']
                    if 'unused' in message.lower() or 'redefined' in message.lower() or 'unreachable' in message.lower():
                        errors.append({
                            'line': issue.get('line', 0),
                            'column': issue.get('column', 0),
                            'type': issue['type'].capitalize(),
                            'message': f"{message} ({issue['message-id']})"
                        })
    except Exception as e:
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'Error',
            'message': f'Pylint error: {str(e)}'
        })
    finally:
        os.unlink(temp_file)

    return errors if errors else [{'message': 'No errors found'}]

def check_javascript_code(code):
    errors = []
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as temp:
        temp.write(code)
        temp_file = temp.name

    try:
        jshint_cmd = ['node', 'check_js_jshint.js', temp_file]
        logger.debug(f"Running JSHint command: {' '.join(jshint_cmd)}")
        result = subprocess.run(
            jshint_cmd,
            capture_output=True,
            text=True
        )
        if result.stderr:
            logger.error(f"JSHint stderr: {result.stderr}")
            errors.append({
                'line': 0,
                'column': 0,
                'type': 'JSHintError',
                'message': f'JSHint stderr: {result.stderr}'
            })
        if result.stdout:
            try:
                jshint_errors = json.loads(result.stdout)
                errors.extend(jshint_errors)
            except json.JSONDecodeError as e:
                logger.error(f"JSHint JSON parse error: {str(e)}")
                errors.append({
                    'line': 0,
                    'column': 0,
                    'type': 'JSONError',
                    'message': f'Failed to parse JSHint output: {str(e)}'
                })
        if not errors and result.returncode != 0:
            errors.append({
                'line': 0,
                'column': 0,
                'type': 'JSHintError',
                'message': f'JSHint failed with exit code {result.returncode}'
            })
    except FileNotFoundError as e:
        logger.error(f"JSHint or Node.js not found: {str(e)}")
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'ConfigError',
            'message': 'JSHint or Node.js not found. Ensure JSHint is installed (npm install -g jshint) and Node.js is installed.'
        })
    except Exception as e:
        logger.error(f"Unexpected JSHint error: {str(e)}")
        errors.append({
            'line': 0,
            'column': 0,
            'type': 'Error',
            'message': f'Unexpected JSHint error: {str(e)}'
        })
    finally:
        os.unlink(temp_file)

    return errors if errors else [{'message': 'No errors found'}]

def generate_autopilot_code(instruction, language, code):
    try:
        language_map = {'python': 'Python', 'javascript': 'JavaScript'}
        lang = language_map.get(language.lower(), 'Python')
        completion = client.chat.completions.create(
            model="deepseek/deepseek-r1:free",
            messages=[
                {
                    "role": "system",
                    "content": f"You are an expert {lang} coder. Generate {lang} code based on the user's instruction, considering the existing code for context. Provide only the code without explanations, formatted correctly for {lang}. Ensure the code is concise, integrates seamlessly with the existing code, and follows the instruction exactly."
                },
                {
                    "role": "user",
                    "content": f"**Existing Code**:\n```python\n{code}\n```\n**Instruction**: {instruction}"
                }
            ]
        )
        generated_code = completion.choices[0].message.content.strip()
        # Remove markdown code fences if present
        generated_code = re.sub(r'^```[\w]*\n|```$', '', generated_code, flags=re.MULTILINE)
        return {'success': True, 'code': generated_code}
    except Exception as e:
        logger.error(f"OpenRouter API error: {str(e)}")
        return {'success': False, 'error': f'Failed to generate code: {str(e)}'}

def get_code_fix(code, error):
    try:
        completion = client.chat.completions.create(
            model="deepseek/deepseek-r1:free",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert code debugger. Analyze the provided code and error, identify the problem, and suggest a fix. Provide a clear explanation and the corrected code."
                },
                {
                    "role": "user",
                    "content": f"**Code**:\n```python\n{code}\n```\n**Error**:\nLine {error['line']}, Col {error['column']}: {error['message']} ({error['type']})"
                }
            ]
        )
        fix_suggestion = completion.choices[0].message.content
        return {'success': True, 'fix': fix_suggestion}
    except Exception as e:
        logger.error(f"OpenRouter API error: {str(e)}")
        return {'success': False, 'error': f'Failed to fetch fix: {str(e)}'}

@app.route('/')
def index():
    return render_template('ext/rtvc-assistant/src/webview/webview.html')

@socketio.on('check_code')
def handle_check_code(data):
    code = data.get('code', '')
    language = data.get('language', '').lower()
    errors = []

    if language == 'python':
        errors = check_python_code(code)
    elif language == 'javascript':
        errors = check_javascript_code(code)
    else:
        errors = [{'message': 'Unsupported language'}]

    socketio.emit('code_errors', {
        'errors': errors,
        'code': code
    })

@socketio.on('fix_code')
def handle_fix_code(data):
    code = data.get('code', '')
    error = data.get('error', {})
    fix_result = get_code_fix(code, error)
    socketio.emit('code_fix', {'error': error, 'fix_result': fix_result})

@socketio.on('autopilot_code')
def handle_autopilot_code(data):
    instruction = data.get('instruction', '')
    line = data.get('line', 0)
    language = data.get('language', '').lower()
    code = data.get('code', '')
    result = generate_autopilot_code(instruction, language, code)
    socketio.emit('autopilot_result', {
        'line': line,
        'result': result
    })

if __name__ == "__main__":
    try:
        #port = find_free_port()
        #print(f"Starting server on port {port}")
        #socketio.run(app, port=port, debug=True)
        app.run(debug=True)
    except OSError as e:
        print(f"Error: {e}")
        print("Could not find a free port. Please check for running processes.")