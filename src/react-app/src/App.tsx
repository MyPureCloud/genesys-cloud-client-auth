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
  } catch (e) {
    response = (
      <div>
        <h2 style={{ color: '#ea0b0b' }}>{t('error')}</h2>
        <h3>{t(e.message)}</h3>
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
        <h4>{t('closeWindowMsg')}</h4>
      </div>
    </div>
  );
}
