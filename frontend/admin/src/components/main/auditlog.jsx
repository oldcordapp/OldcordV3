const AuditLog = ({ action, moderation_id, timestamp, reasoning, moderated_id, moderation_props }) => {
    return (
        <>
            <tr className='mainPage-main-components-infoCard-table-tr' style={{
                cursor: 'auto'
            }}>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {action}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {moderation_id}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {timestamp}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {reasoning}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {moderated_id}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {moderation_props}
                </td>
            </tr>
        </>
    )
}


export default AuditLog;