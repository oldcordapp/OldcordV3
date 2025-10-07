import React from 'react';

const Channel = ({ name, id, type, position }) => {
    function manageChannel () {
        window.location.href = `/channels/${id}`;
    }

    return (
        <>
            <tr className='mainPage-main-components-infoCard-table-tr' onClick={manageChannel} title="Click to manage channel">
                <td className='mainPage-main-components-infoCard-table-td'>
                    {name}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {id}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {type}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {position}
                </td>
            </tr>
        </>
    )
}


export default Channel;