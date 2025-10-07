import React from 'react';

const Member = ({ avatarHash, username, discriminator, id }) => {
    return (
        <>
            <tr className='mainPage-main-components-infoCard-table-tr' title="Click to manage member">
                <td className='mainPage-main-components-infoCard-table-td'>
                    <a href={`/users/${id}`} style={{ 'textDecoration': 'none' }}>
                        <div className='mainPage-main-components-infoCard-table-member'>
                            <div className='mainPage-main-components-infoCard-table-member-avatar avatar' style={{ 'backgroundImage': `url('${avatarHash}')` }}></div>
                            <div className='mainPage-main-components-infoCard-table-member-username'>{username}</div>
                        </div>
                    </a>
                </td>
                <td class="mainPage-main-components-infoCard-table-td">
                    <div class="mainPage-main-components-infoCard-table-discriminator">{discriminator}</div>
                </td>
            </tr>
        </>
    )
}


export default Member;