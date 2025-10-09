const Dropdown = ({ contextMenu, onClose }) => {
    const handleActionClick = (action) => {
        action();
        onClose();
    };

    return (
        <div className='mainPage-main-components-dropDownMenu'>
            {contextMenu.map((entry, key) => (
                <div key={key} className={`mainPage-main-components-dropDownMenu-item ${entry.not_implemented_yet ? 'not-allowed-dropdown' : ''}`} onClick={() => handleActionClick(entry.action)}>
                    {entry.name}
                </div>
            ))}
        </div>
    );
};

export default Dropdown;