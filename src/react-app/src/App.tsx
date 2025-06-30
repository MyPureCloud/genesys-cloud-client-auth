import { GuxIcon } from 'genesys-spark-components-react';
import './App.css';
import { useTranslation } from 'react-i18next';
import { handleRedirectFromLogin } from '../../lib/parse-redirect';

const App = () => {
  const { t } = useTranslation();
  let response = <h3>{t('successMsg')}</h3>;

  try {
    handleRedirectFromLogin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        <GuxIcon
          className='logo'
          icon-name='legacy/genesys-logo-full'
          decorative={true}
        ></GuxIcon>
        { response }
        <h1>{t('closeWindowMsg')}</h1>
      </div>
    </div>
  );
}

export default App;