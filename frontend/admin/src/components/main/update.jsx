import ic_error from '../../assets/ic_error.svg';
import IcError from '../../assets/ic_error.svg?react';
import ic_satisfied from '../../assets/ic_satisfied.svg';
import ic_update from '../../assets/ic_update.svg';

const Update = ({ status, error, latestCommit }) => {
  switch (status) {
    case 'checking':
      return (
        <div className="search-no-results">
          <img src={ic_update} alt="Checking for updates..." />
          <p>Checking for updates...</p>
        </div>
      );
    case 'up-to-date':
      return (
        <div className="search-no-results">
          <img src={ic_satisfied} alt="Congrats! You are running the latest version." />
          <p>Congrats! You are running the latest version.</p>
        </div>
      );
    case 'update-available':
      return (
        <div className="update-available">
          <div className="update-available-text">
            <IcError />
            <div>An update is available!</div>
          </div>
          <div className="update-available-commit">
            <p>
              Latest commit:{' '}
              <a
                href={`https://github.com/oldcordapp/OldcordV3/commit/${latestCommit.sha}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {latestCommit.message}
              </a>
            </p>
            <p>
              By {latestCommit.author} on {new Date(latestCommit.date).toLocaleString()}
            </p>
          </div>
          <div className="update-instructions">
            <p>To update:</p>
            <ol>
              <li>Kill the running server process.</li>
              <li>
                Run <div className="block">git pull</div>.
              </li>
              <li>
                Update <div className="block">config.json</div> if needed.
              </li>
              <li>
                Run <div className="block">npm run start</div>.
              </li>
            </ol>
          </div>
        </div>
      );
    case 'update-disabled':
      return (
        <div className="search-no-results">
          <img
            src={ic_error}
            alt="Update is disabled due to VITE_APP_DISABLE_UPDATE_CHECK is true."
          />
          <p>Update is disabled due to VITE_APP_DISABLE_UPDATE_CHECK is true.</p>
        </div>
      );
    case 'error':
      return (
        <div className="search-no-results">
          <img src={ic_error} alt="Error checking for updates." />
          <p>Error checking for updates: {error}</p>
        </div>
      );
  }
};

export default Update;
