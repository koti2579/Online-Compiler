import React from 'react';
import './LanguageSelector.css';

interface Language {
  id: string;
  name: string;
  extension: string;
}

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange
}) => {
  const languages: Language[] = [
    { id: 'javascript', name: 'JavaScript', extension: '.js' },
    { id: 'python', name: 'Python', extension: '.py' },
    { id: 'java', name: 'Java', extension: '.java' },
    { id: 'cpp', name: 'C++', extension: '.cpp' },
    { id: 'c', name: 'C', extension: '.c' }
  ];

  return (
    <div className="language-selector">
      <label htmlFor="language-select">Language:</label>
      <select
        id="language-select"
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="language-dropdown"
      >
        {languages.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.name} ({lang.extension})
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;