const express = require('express');
const router = express.Router();
const codeExecutor = require('../services/codeExecutor');

// Execute code
router.post('/execute', async (req, res) => {
  try {
    const { code, language, input = '' } = req.body;

    // Validation
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    // Additional validation for code
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Code must be a string' });
    }

    if (!code.trim()) {
      return res.status(400).json({ error: 'Code cannot be empty' });
    }
    
    // Supported languages
    const supportedLanguages = ['javascript', 'python', 'cpp', 'c', 'php'];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Unsupported language',
        supportedLanguages 
      });
    }

    // Code length validation
    if (code.length > 50000) {
      return res.status(400).json({ error: 'Code is too long (max 50KB)' });
    }

    // Execute code
    const result = await codeExecutor.executeCode(code, language.toLowerCase(), input);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({ 
      error: 'Code execution failed',
      message: error.message 
    });
  }
});

// Self-test: run minimal programs for each supported language
router.get('/selftest', async (req, res) => {
  const samples = {
    javascript: 'console.log("OK")',
    python: 'print("OK")',
    php: '<?php echo "OK"; ?>',
    c: '#include <stdio.h>\nint main(){ printf("OK"); return 0; }',
    cpp: '#include <iostream>\nint main(){ std::cout << "OK"; return 0; }'
  };

  const languages = ['javascript', 'python', 'cpp', 'c', 'php'];

  try {
    const results = await Promise.all(languages.map(async (lang) => {
      const result = await codeExecutor.executeCode(samples[lang], lang, '');
      return { language: lang, result };
    }));

    res.json({ success: true, results });
  } catch (error) {
    console.error('Selftest error:', error);
    res.status(500).json({ error: 'Selftest failed', message: error.message });
  }
});

// Get supported languages
router.get('/languages', (req, res) => {
  const languages = [
    {
      id: 'javascript',
      name: 'JavaScript',
      version: 'Node.js',
      extension: '.js'
    },
    {
      id: 'python',
      name: 'Python',
      version: '3.x',
      extension: '.py'
    },
    {
      id: 'cpp',
      name: 'C++',
      version: 'GCC',
      extension: '.cpp'
    },
    {
      id: 'c',
      name: 'C',
      version: 'GCC',
      extension: '.c'
    },
    {
      id: 'php',
      name: 'PHP',
      version: '7.x+',
      extension: '.php'
    }
  ];

  res.json({ languages });
});

module.exports = router;