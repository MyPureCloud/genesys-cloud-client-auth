import './App.css';
import { useTranslation } from 'react-i18next';

declare var GenesysCloudClientAuth: {
  handleRedirectFromLogin: () => void;
};

export default function App() {
  const { t } = useTranslation();
  let response = <h3>{t('successMsg')}</h3>;

  try {
    GenesysCloudClientAuth.handleRedirectFromLogin();
  } catch (e: any) {
    response = (
      <div>
        <p style={{ color: '#ea0b0b' }}>{t('error')}</p>
        <p>{t(e.translationKey)}</p>
      </div>
    );
  }

  return (
    <div className='App'>
      <div className='content'>
        <gux-icon
          className='logo'
          icon-name='genesys-logo-full'
          decorative={true}
        ></gux-icon>
        {response}
        <h1>{t('closeWindowMsg')}</h1>
      </div>
    </div>
  );
}
