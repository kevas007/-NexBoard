import React, { useState, useEffect } from 'react';
import { useTranslation, Language } from '../hooks/useTranslation';
import { Select } from './ui/Select';

const LanguageSelector: React.FC = () => {
  const { language, changeLanguage, t } = useTranslation();
  const [, setForceUpdate] = useState(0);

  // Écouter les changements de langue pour forcer le re-render
  useEffect(() => {
    const handleLanguageChange = () => {
      setForceUpdate(prev => prev + 1);
    };
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  const languageOptions = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇺🇸' }
  ];

  const handleLanguageChange = (newLanguage: string) => {
    changeLanguage(newLanguage as Language);
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {t('common.language') || (language === 'fr' ? 'Langue' : 'Language')}:
      </span>
      <Select
        value={language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        options={languageOptions.map(option => ({
          value: option.value,
          label: `${option.flag} ${option.label}`
        }))}
        className="w-40"
      />
    </div>
  );
};

export default LanguageSelector;
