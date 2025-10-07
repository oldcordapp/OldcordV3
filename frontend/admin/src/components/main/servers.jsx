import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import Sidebar from './sidebar';
import Avatar from './avatar';
import Searchbar from './searchbar';
import Server from './server';
import ServerCard from './servercard';

import DefaultAvatar from '../../assets/default-avatar.png'
import NoResults from '../../assets/img_noresults.svg'

const Servers = () => {
    const location = useLocation();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const inputText = searchParams.get('searchInput');
        
        if (inputText) {
            fetch(`http://127.0.0.1:1337/api/admin/guilds/search?input=${inputText}`, {
                headers: {
                    'Authorization': "", // Please put a token here for testing thank you
                    'Cookie' : 'release_date=december_22_2016;',
                  },
            }).then((response) => {
                return response.json();
            }).then((data) => {
                if (data.code > 400) {
                    setError(data.message);
                } else {
                    if (Array.isArray(data) && data.length === 0) {
                        setData(null);
                    } else setData(data);
                }
            }).catch((error) => {
                setError(error.message);
            });
        }
    }, [location.search]);

    return (
        <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
            <div className='mainPage-container'>
                <Sidebar active="Servers"></Sidebar>
                <div className='mainPage-main'>
                    <div className='mainPage-main-header'>
                        <div className='mainPage-main-header-components'>
                            <Searchbar placeholder="Search Servers..." error={error}></Searchbar>
                        </div>
                        <Avatar path={DefaultAvatar}></Avatar>
                    </div>
                    <div className='mainPage-main-components' style={ Array.isArray(data) && data.length > 2 ? {flexFlow: 'column'} : {}}>
                        {data == null ? <>
                            <div className='search-no-results'>
                                <img src={NoResults} alt="No Results Found"></img>
                                <p>No Results Found</p>
                            </div>
                        </> : <>
                            {Array.isArray(data) ? (
                                data.reduce((acc, _, i, arr) => {
                                    if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
                                    return acc;
                                }, []).map((chunk, i) => (
                                    <div className='server-cards-row' key={i}>
                                        {chunk.map((item, j) => (
                                            <ServerCard data={item} key={j} joined={false} />
                                        ))}
                                    </div>
                                ))
                            ) : (
                                <Server data={data} />
                            )}
                        </>}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Servers;