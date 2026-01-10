import { createContext, useContext, useEffect,useState } from 'react';

const AuthUserContext = createContext(null);

export const useAuthUser = () => useContext(AuthUserContext);

export const AuthUserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const storedUser = localStorage.getItem('user_data');

      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsLoading(false);
      }

      const response = await fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/@me`, {
        headers: {
          Authorization: token.replace(/"/g, ''),
          Cookie: 'release_date=october_5_2017;',
        },
      });

      if (!response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('user_data');
        setUser(null);
        location.reload();
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();

      setUser(userData);

      localStorage.setItem('user_data', JSON.stringify(userData));
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const contextValue = {
    user,
    isLoading,
    fetchUserData,
  };

  return <AuthUserContext.Provider value={contextValue}>{children}</AuthUserContext.Provider>;
};
