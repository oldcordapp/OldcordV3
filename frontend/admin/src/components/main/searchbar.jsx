import Ic_search from '../../assets/ic_search.svg?react';

const Searchbar = ({ placeholder, error }) => {
  return (
    <form>
      <div className={error == null ? 'searchbar-input' : 'searchbar-input input-shift'}>
        {error == null ? (
          <>
            <input
              type='text'
              placeholder={placeholder}
              name='searchInput'
              className='searchbar-input-text'
            ></input>
          </>
        ) : (
          <>
            <input
              type='text'
              placeholder={placeholder}
              name='searchInput'
              className='searchbar-input-text input-error'
            ></input>
          </>
        )}
        <div
          className={
            error == null ? 'searchbar-input-button' : 'searchbar-input-button input-button-shift'
          }
          style={{ marginLeft: '-25px', display: 'flex' }}
        >
          <Ic_search style={{ fill: '#E4E6E9' }} />
        </div>
      </div>
      {error == null ? (
        <></>
      ) : (
        <>
          <div className='input-error-text'>{error}</div>
        </>
      )}
      <input
        type='submit'
        style={{
          display: 'none',
          fontFamily: 'Whitney, Helvetica Neue, Helvetica, Arial, sans-serif',
        }}
      ></input>
    </form>
  );
};

export default Searchbar;
