import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type Language = 'fr' | 'en';

interface TranslationData {
  [key: string]: any;
}

interface TranslationContextType {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
  changeLanguage: (newLanguage: Language) => void;
  isLoading: boolean;
  availableLanguages: Language[];
}

const translations: Record<Language, TranslationData> = {
  fr: {},
  en: {}
};

// Charger les traductions
const loadTranslations = async (language: Language): Promise<TranslationData> => {
  // Essayer plusieurs chemins possibles
  const paths = [
    `/locales/${language}.json`,
    `./locales/${language}.json`,
    `/public/locales/${language}.json`
  ];

  for (const path of paths) {
  try {
      const response = await fetch(path, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Traductions ${language} chargées depuis: ${path} (${Object.keys(data).length} clés)`);
        return data;
      }
    } catch (e) {
      // Continuer avec le chemin suivant
      continue;
    }
  }

  console.error(`❌ Impossible de charger les traductions ${language} depuis aucun chemin:`, paths);
    return {};
};

// Initialiser les traductions
const initializeTranslations = async () => {
  try {
    // Charger les deux langues en parallèle
    const [frData, enData] = await Promise.all([
      loadTranslations('fr'),
      loadTranslations('en')
    ]);
    translations.fr = frData;
    translations.en = enData;
    console.log('✅ Traductions initialisées:', {
      fr: Object.keys(frData).length,
      en: Object.keys(enData).length
    });
  } catch (error) {
    console.error('❌ Error initializing translations:', error);
  }
};

// Initialiser au chargement du module
initializeTranslations();

// Créer le contexte
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Provider component
export function TranslationProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    // Charger la langue depuis localStorage au démarrage
    const savedLanguage = localStorage.getItem('nexboard-language') as Language;
    if (savedLanguage && (savedLanguage === 'fr' || savedLanguage === 'en')) {
      return savedLanguage;
    }
    return 'fr';
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      setIsLoading(true);
      try {
        // Toujours recharger pour s'assurer que les traductions sont à jour
        const loaded = await loadTranslations(currentLanguage);
        translations[currentLanguage] = loaded;
        console.log(`✅ Traductions ${currentLanguage} chargées:`, Object.keys(loaded).length, 'clés');
      } catch (error) {
        console.error(`❌ Error loading ${currentLanguage} translations:`, error);
        // En cas d'erreur, essayer de charger depuis le cache ou utiliser des traductions vides
        if (!translations[currentLanguage] || Object.keys(translations[currentLanguage]).length === 0) {
          translations[currentLanguage] = {};
          console.warn(`⚠️ Using empty translations for ${currentLanguage}`);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, [currentLanguage]);

  // Écouter les changements de langue depuis d'autres instances (pour compatibilité)
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      const newLanguage = e.detail as Language;
      if (newLanguage !== currentLanguage && (newLanguage === 'fr' || newLanguage === 'en')) {
        setCurrentLanguage(newLanguage);
      }
    };

    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
  }, [currentLanguage]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    // Si les traductions sont en cours de chargement, retourner la clé temporairement
    if (isLoading && (!translations[currentLanguage] || Object.keys(translations[currentLanguage]).length === 0)) {
      return key;
    }

    const keys = key.split('.');
    let value: any = translations[currentLanguage];

    // Si la langue actuelle n'a pas de traductions, essayer l'anglais
    if (!value || Object.keys(value).length === 0) {
      value = translations.en;
      // Si l'anglais n'a pas de traductions non plus, retourner la clé
      if (!value || Object.keys(value).length === 0) {
        console.warn(`⚠️ No translations loaded for ${currentLanguage} or en`);
        return key;
      }
    }

    // Naviguer dans l'objet de traduction
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback vers l'anglais si la clé n'existe pas dans la langue actuelle
        if (currentLanguage !== 'en' && translations.en && Object.keys(translations.en).length > 0) {
          value = translations.en;
          for (const k2 of keys) {
            if (value && typeof value === 'object' && k2 in value) {
              value = value[k2];
            } else {
              // Clé non trouvée même en anglais
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ Translation key not found: ${key}`);
              }
              return key; // Retourner la clé si pas trouvée
            }
          }
          // Si on a trouvé en anglais, sortir de la boucle
          break;
        } else {
          // Clé non trouvée
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ Translation key not found: ${key}`);
          }
          return key; // Retourner la clé si pas trouvée
        }
      }
    }

    if (typeof value !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Translation value is not a string for key: ${key}`, value);
      }
      return key;
    }

    // Remplacer les paramètres (support {name} et {{name}})
    if (params) {
      return value.replace(/\{\{?(\w+)\}?\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  };

  const changeLanguage = (newLanguage: Language) => {
    if (newLanguage === currentLanguage) return; // Éviter les changements inutiles
    
    // Sauvegarder la préférence d'abord
    localStorage.setItem('nexboard-language', newLanguage);
    
    // Changer la langue (cela déclenchera automatiquement le re-render via React Context)
    setCurrentLanguage(newLanguage);
    
    // Déclencher un événement pour forcer le re-render de tous les composants qui écoutent
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: newLanguage }));
  };

  return (
    <TranslationContext.Provider
      value={{
        t,
        language: currentLanguage,
        changeLanguage,
        isLoading,
        availableLanguages: ['fr', 'en'] as Language[]
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
}

// Hook pour utiliser les traductions
export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  if (!context) {
    // Fallback si le contexte n'est pas disponible (pour compatibilité)
    const fallbackLanguage: Language = (localStorage.getItem('nexboard-language') as Language) || 'fr';
    return {
      t: (key: string) => key,
      language: fallbackLanguage,
      changeLanguage: () => {},
      isLoading: false,
      availableLanguages: ['fr', 'en']
    };
  }
  return context;
};

export default useTranslation;
