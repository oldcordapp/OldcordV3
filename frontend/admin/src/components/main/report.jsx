import Button from "@oldcord/frontend-shared/components/button";
import { useNavigate } from 'react-router-dom';

const Report = ({ id, problem, email_address, onDiscard, onApprove, selected = false }) => {
    const navigate = useNavigate();
    const targetPath = `/reports?selectedId=${id}`;

    const handleRowClick = (e) => {
        if (e.target.closest('button')) {
            //stop quick action buttons from setting the selected report
            return;
        }

        navigate(targetPath);
    };

    return (
        <>
            <tr className={`mainPage-main-components-infoCard-table-tr ${selected ? 'selected-report-entry' : ''}`} onClick={handleRowClick}>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {id}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {problem}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    {email_address}
                </td>
                <td className='mainPage-main-components-infoCard-table-td'>
                    <div>
                        <Button variant="danger" onClick={(e) => {
                            //e.stopPropagation();
                            onDiscard();
                        }} style={{
                            marginRight: '5px',
                            fontFamily: 'Nebula Sans'
                        }}>Discard</Button>
                        <Button variant="success" onClick={(e) => {
                            //e.stopPropagation();
                            onApprove();
                        }} style={{
                            fontFamily: 'Nebula Sans'
                        }}>Approve</Button>
                    </div>
                </td>
            </tr>
        </>
    )
}


export default Report;