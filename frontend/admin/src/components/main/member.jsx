import { useNavigate } from 'react-router-dom';
const Member = ({
  avatarHash,
  username,
  discriminator,
  id,
  actuallyServer = false,
  bot = false,
}) => {
  const navigate = useNavigate();
  const targetPath = `/${actuallyServer ? 'servers' : bot ? 'bots' : 'users'}?searchInput=${id}`;

  const handleRowClick = () => {
    navigate(targetPath);
  };

  return (
    <>
      <tr className='mainPage-main-components-infoCard-table-tr' onClick={handleRowClick}>
        <td className='mainPage-main-components-infoCard-table-td'>
          <div className='mainPage-main-components-infoCard-table-member'>
            <div
              className='mainPage-main-components-infoCard-table-member-avatar avatar'
              style={{ backgroundImage: `url('${avatarHash}')` }}
            ></div>
            <div className='mainPage-main-components-infoCard-table-member-username'>
              {username}
            </div>
          </div>
        </td>
        {discriminator === null ? (
          <></>
        ) : (
          <>
            <td className='mainPage-main-components-infoCard-table-td'>
              <div className='mainPage-main-components-infoCard-table-discriminator'>
                {discriminator}
              </div>
            </td>
          </>
        )}
      </tr>
    </>
  );
};

export default Member;
