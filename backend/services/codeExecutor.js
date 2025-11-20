const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create temp directory if it doesn't exist
const TEMP_DIR = path.join(__dirname, '../temp');
fs.ensureDirSync(TEMP_DIR);

// Execution timeout (10 seconds)
const EXECUTION_TIMEOUT = 10000;

// Memory limit (128MB)
const MEMORY_LIMIT = '128m';

const executeCode = async (code, language, input = '') => {
  const sessionId = uuidv4();
  const sessionDir = path.join(TEMP_DIR, sessionId);
  
  try {
    // Create session directory
    await fs.ensureDir(sessionDir);

    let result;
    switch (language) {
      case 'javascript':
        result = await executeJavaScript(code, input, sessionDir);
        break;
      case 'python':
        result = await executePython(code, input, sessionDir);
        break;
      case 'cpp':
        result = await executeCpp(code, input, sessionDir);
        break;
      case 'c':
        result = await executeC(code, input, sessionDir);
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    return result;
  } finally {
    // Clean up session directory
    try {
      await fs.remove(sessionDir);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
};

const executeJavaScript = async (code, input, sessionDir) => {
  const filename = path.join(sessionDir, 'script.js');
  
  // Security: Basic code validation
  if (code.includes('require(') && !code.includes('// @allow-require')) {
    throw new Error('require() is not allowed for security reasons');
  }
  
  await fs.writeFile(filename, code);
  
  return new Promise((resolve) => {
    const process = spawn('node', [filename], {
      cwd: sessionDir,
      timeout: EXECUTION_TIMEOUT
    });

    let output = '';
    let error = '';

    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    }

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        output: output.trim(),
        error: error.trim(),
        exitCode: code,
        executionTime: Date.now()
      });
    });

    process.on('error', (err) => {
      resolve({
        output: '',
        error: err.message,
        exitCode: 1,
        executionTime: Date.now()
      });
    });
  });
};

const executePython = async (code, input, sessionDir) => {
  const filename = path.join(sessionDir, 'script.py');
  
  // Security: Basic validation
  const dangerousImports = ['os', 'subprocess', 'sys', 'socket', 'urllib'];
  const codeLines = code.split('\n');
  for (const line of codeLines) {
    for (const dangerous of dangerousImports) {
      if (line.includes(`import ${dangerous}`) || line.includes(`from ${dangerous}`)) {
        throw new Error(`Import '${dangerous}' is not allowed for security reasons`);
      }
    }
  }
  
  await fs.writeFile(filename, code);
  
  return new Promise((resolve) => {
    const process = spawn('python', [filename], {
      cwd: sessionDir,
      timeout: EXECUTION_TIMEOUT
    });

    let output = '';
    let error = '';

    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    }

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        output: output.trim(),
        error: error.trim(),
        exitCode: code,
        executionTime: Date.now()
      });
    });

    process.on('error', (err) => {
      resolve({
        output: '',
        error: err.message,
        exitCode: 1,
        executionTime: Date.now()
      });
    });
  });
};

// Helper: ensure .exe suffix on Windows when using absolute paths
const ensureWinExe = (candidate) => {
  if (process.platform !== 'win32') return candidate;
  try {
    // If path has no extension, try appending .exe if it exists
    if (!path.extname(candidate)) {
      const exeCandidate = `${candidate}.exe`;
      if (fs.pathExistsSync(exeCandidate)) return exeCandidate;
    }
  } catch (_) {}
  return candidate;
};

// Binary path resolution to support non-standard installs and env overrides
const resolveBinary = (name) => {
  if (name === 'gcc') {
    const fromEnv = process.env.GCC_PATH;
    return fromEnv ? ensureWinExe(fromEnv) : 'gcc';
  }
  if (name === 'g++') {
    const fromEnv = process.env.GPP_PATH || process.env.GXX_PATH;
    return fromEnv ? ensureWinExe(fromEnv) : 'g++';
  }
  return name;
};

// Verify a binary exists by attempting to read version and provide diagnostic hint
const checkBinary = (name) => {
  return new Promise((resolve) => {
    const bin = resolveBinary(name);
    const args = ['--version'];
    let out = '';
    let err = '';
    const proc = spawn(bin, args);

    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });

    const hintFor = () => 'Ensure the tool is installed and on PATH';

    proc.on('error', (e) => {
      resolve({ name, path: bin, available: false, version: '', error: e.message, hint: hintFor(name) });
    });

    proc.on('close', (code) => {
      const text = (out || err).trim();
      resolve({ name, path: bin, available: code === 0, version: text, error: code === 0 ? '' : err.trim(), hint: code === 0 ? '' : hintFor(name) });
    });
  });
};

// Expose statuses for health checks
const getBinaryStatuses = async () => {
  const targets = ['node', 'python', 'gcc', 'g++'];
  const results = await Promise.all(targets.map(checkBinary));
  return results;
};


// Use resolved binary for C++ compilation
const executeCpp = async (code, input, sessionDir) => {
  const sourceFile = path.join(sessionDir, 'program.cpp');
  const executableFile = path.join(sessionDir, 'program.exe');
  
  await fs.writeFile(sourceFile, code);
  
  return new Promise((resolve) => {
    // Compile first
    const compileProcess = spawn(resolveBinary('g++'), [sourceFile, '-o', executableFile], {
      cwd: sessionDir,
      timeout: EXECUTION_TIMEOUT
    });

    let compileError = '';

    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    // Handle missing compiler or spawn errors
    compileProcess.on('error', (err) => {
      resolve({
        output: '',
        error: `C++ compiler not available: ${err.message}`,
        exitCode: 1,
        executionTime: Date.now()
      });
    });

    compileProcess.on('close', (compileCode) => {
      if (compileCode !== 0) {
        resolve({
          output: '',
          error: `Compilation failed: ${compileError}`,
          exitCode: compileCode,
          executionTime: Date.now()
        });
        return;
      }

      // Execute compiled program
      const runProcess = spawn(executableFile, [], {
        cwd: sessionDir,
        timeout: EXECUTION_TIMEOUT
      });

      let output = '';
      let error = '';

      if (input) {
        runProcess.stdin.write(input);
        runProcess.stdin.end();
      }

      runProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      runProcess.on('close', (code) => {
        resolve({
          output: output.trim(),
          error: error.trim(),
          exitCode: code,
          executionTime: Date.now()
        });
      });

      runProcess.on('error', (err) => {
        resolve({
          output: '',
          error: err.message,
          exitCode: 1,
          executionTime: Date.now()
        });
      });
    });
  });
};

const executeC = async (code, input, sessionDir) => {
  const sourceFile = path.join(sessionDir, 'program.c');
  const executableFile = path.join(sessionDir, 'program.exe');
  
  await fs.writeFile(sourceFile, code);
  
  return new Promise((resolve) => {
    // Compile first
    const compileProcess = spawn(resolveBinary('gcc'), [sourceFile, '-o', executableFile], {
      cwd: sessionDir,
      timeout: EXECUTION_TIMEOUT
    });

    let compileError = '';

    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    // Handle missing compiler or spawn errors
    compileProcess.on('error', (err) => {
      resolve({
        output: '',
        error: `C compiler not available: ${err.message}`,
        exitCode: 1,
        executionTime: Date.now()
      });
    });

    compileProcess.on('close', (compileCode) => {
      if (compileCode !== 0) {
        resolve({
          output: '',
          error: `Compilation failed: ${compileError}`,
          exitCode: compileCode,
          executionTime: Date.now()
        });
        return;
      }

      // Execute compiled program
      const runProcess = spawn(executableFile, [], {
        cwd: sessionDir,
        timeout: EXECUTION_TIMEOUT
      });

      let output = '';
      let error = '';

      if (input) {
        runProcess.stdin.write(input);
        runProcess.stdin.end();
      }

      runProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      runProcess.on('close', (code) => {
        resolve({
          output: output.trim(),
          error: error.trim(),
          exitCode: code,
          executionTime: Date.now()
        });
      });

      runProcess.on('error', (err) => {
        resolve({
          output: '',
          error: err.message,
          exitCode: 1,
          executionTime: Date.now()
        });
      });
    });
  });
};

module.exports = { executeCode, getBinaryStatuses };