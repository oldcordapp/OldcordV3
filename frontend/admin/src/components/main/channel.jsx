import { useNavigate } from 'react-router-dom';
const Channel = ({ name, id, type, position }) => {
  const navigate = useNavigate();
  const targetPath = `/messages?channelid=${id}`;

  const handleRowClick = () => {
    navigate(targetPath);
  };

  return (
    <>
      <tr
        className="mainPage-main-components-infoCard-table-tr"
        style={{
          cursor: type.toLowerCase() === 'text' ? 'pointer' : 'auto',
        }}
        onClick={type.toLowerCase() === 'text' ? handleRowClick : {}}
      >
        <td className="mainPage-main-components-infoCard-table-td">{name}</td>
        <td className="mainPage-main-components-infoCard-table-td">{id}</td>
        <td className="mainPage-main-components-infoCard-table-td">{type}</td>
        <td className="mainPage-main-components-infoCard-table-td">{position}</td>
      </tr>
    </>
  );
};

export default Channel;
