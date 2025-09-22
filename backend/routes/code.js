const express = require('express');
const { executeCode } = require('../services/codeExecutor');
const auth = require('../middleware/auth');

const router = express.Router();

// Execute code
router.post('/execute', auth, async (req, res) => {
  try {
    const { code, language, input = '' } = req.body;

    // Validation
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    // Supported languages
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp', 'c', 'php'];
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
    const result = await executeCode(code, language.toLowerCase(), input);

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
      id: 'java',
      name: 'Java',
      version: 'JDK 11+',
      extension: '.java'
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