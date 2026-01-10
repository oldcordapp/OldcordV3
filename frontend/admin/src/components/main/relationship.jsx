import { useNavigate } from 'react-router-dom';

const Relationship = ({ avatarHash, username, discriminator, id, type }) => {
    const navigate = useNavigate();
    const targetPath = `/users?searchInput=${id}`;

    const handleRowClick = () => {
        navigate(targetPath);
    };

    return (
        <>
            <tr className='mainPage-main-components-infoCard-table-tr' onClick={handleRowClick}>
                <td className='mainPage-main-components-infoCard-table-td'>
                        <div className='mainPage-main-components-infoCard-table-member'>
                            <div className='mainPage-main-components-infoCard-table-member-avatar avatar' style={{ 'backgroundImage': `url('${avatarHash}')` }}></div>
                            <div className='mainPage-main-components-infoCard-table-member-username'>{username}</div>
                        </div>
                </td>
                {discriminator === null ? <></> : <>
                    <td className="mainPage-main-components-infoCard-table-td">
                        <div className="mainPage-main-components-infoCard-table-discriminator">{discriminator}</div>
                    </td>
                </>}
                <td className="mainPage-main-components-infoCard-table-td">
                    <div className="mainPage-main-components-infoCard-table-discriminator">{type}</div>
                </td>
            </tr>
        </>
    )
}


export default Relationship;