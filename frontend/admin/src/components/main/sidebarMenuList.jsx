import React from 'react';

const SidebarMenuList = ({ name, children }) => {
    return (
        <>
            <div className='mainPage-sidebar-subheader' id={name}>{name}</div>
            {children}
        </>
    );
};

export default SidebarMenuList;