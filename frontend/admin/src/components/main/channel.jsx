import React from 'react';

const Channel = ({ name, id, type, position }) => {
    return (
        <>
            <tr className='mainPage-main-components-infoCard-table-tr'>
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