const Role = ({ name, id, permissions, position, color, hoist, mentionable }) => {
    return (
        <>
            <tr className='mainPage-main-components-infoCard-table-tr' style={{
                cursor: 'auto'
            }}>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {name}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {id}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {permissions}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {position}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {color}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {hoist ? 'Yes' : 'No'}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {mentionable ? 'Yes' : 'No'}
                </td>
            </tr>
        </>
    )
}


export default Role;