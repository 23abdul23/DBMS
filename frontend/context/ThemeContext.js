import React, { createContext, useState, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const subText = isDarkMode ? '#b3b3b3' : '#6b7280';

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: {
      background: isDarkMode ? '#181818' : '#fff',
      text: isDarkMode ? '#fff' : '#181818',
      subText,
      subtext: subText,
      card: isDarkMode ? '#232323' : '#f5f5f5',
      // Add more theme colors as needed
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
