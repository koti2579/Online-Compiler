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
      case 'java':
        result = await executeJava(code, input, sessionDir);
        break;
      case 'cpp':
        result = await executeCpp(code, input, sessionDir);
        break;
      case 'c':
        result = await executeC(code, input, sessionDir);
        break;
      case 'php':
        result = await executePhp(code, input, sessionDir);
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

// Binary path resolution to support non-standard installs and env overrides
const resolveBinary = (name) => {
  if (name === 'javac') {
    const fromEnv = process.env.JAVAC_PATH;
    const javaHome = process.env.JAVA_HOME;
    return fromEnv || (javaHome ? path.join(javaHome, 'bin', 'javac') : 'javac');
  }
  if (name === 'java') {
    const fromEnv = process.env.JAVA_PATH;
    const javaHome = process.env.JAVA_HOME;
    return fromEnv || (javaHome ? path.join(javaHome, 'bin', 'java') : 'java');
  }
  if (name === 'php') {
    return process.env.PHP_PATH || 'php';
  }
  if (name === 'gcc') {
    return process.env.GCC_PATH || 'gcc';
  }
  if (name === 'g++') {
    return process.env.GPP_PATH || process.env.GXX_PATH || 'g++';
  }
  return name;
};

// Verify a binary exists by attempting to read version
const checkBinary = (name) => {
  return new Promise((resolve) => {
    const bin = resolveBinary(name);
    const args = (name === 'java' || name === 'javac') ? ['-version'] : ['--version'];
    let out = '';
    let err = '';
    const proc = spawn(bin, args);

    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });

    proc.on('error', (e) => {
      resolve({ name, path: bin, available: false, version: '', error: e.message });
    });

    proc.on('close', (code) => {
      const text = (out || err).trim();
      resolve({ name, path: bin, available: code === 0, version: text, error: code === 0 ? '' : err.trim() });
    });
  });
};

// Expose statuses for health checks
const getBinaryStatuses = async () => {
  const targets = ['java', 'javac', 'php'];
  const results = await Promise.all(targets.map(checkBinary));
  return results;
};

const executeJava = async (code, input, sessionDir) => {
  // Extract public class name if present; default to Main
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : 'Main';
  const filename = path.join(sessionDir, `${className}.java`);

  await fs.writeFile(filename, code);

  return new Promise((resolve) => {
    // Compile Java
    const compileProcess = spawn(resolveBinary('javac'), [filename], {
      cwd: sessionDir,
      timeout: EXECUTION_TIMEOUT
    });

    let compileError = '';

    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    // Handle missing compiler (ENOENT) or spawn errors gracefully
    compileProcess.on('error', (err) => {
      resolve({
        output: '',
        error: `Java compiler not available: ${err.message}`,
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

      // Run Java program with classpath set to session dir
      const runProcess = spawn(resolveBinary('java'), ['-cp', sessionDir, className], {
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

const executePhp = async (code, input, sessionDir) => {
  const filename = path.join(sessionDir, 'script.php');
  
  // Ensure PHP code starts with <?php
  const phpCode = code.startsWith('<?php') ? code : `<?php\n${code}`;
  
  await fs.writeFile(filename, phpCode);
  
  return new Promise((resolve) => {
    const process = spawn(resolveBinary('php'), [filename], {
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

module.exports = { executeCode, getBinaryStatuses };