import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DatasetContextType {
    activeDatasetId: string | null;
    setActiveDatasetId: (id: string | null) => void;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export const DatasetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeDatasetId, setActiveDatasetIdState] = useState<string | null>(() => {
        return localStorage.getItem('lumina_active_dataset') || null;
    });

    const setActiveDatasetId = (id: string | null) => {
        setActiveDatasetIdState(id);
        if (id) {
            localStorage.setItem('lumina_active_dataset', id);
        } else {
            localStorage.removeItem('lumina_active_dataset');
        }
    };

    return (
        <DatasetContext.Provider value={{ activeDatasetId, setActiveDatasetId }}>
            {children}
        </DatasetContext.Provider>
    );
};

export const useDatasetContext = () => {
    const context = useContext(DatasetContext);
    if (context === undefined) {
        throw new Error('useDatasetContext must be used within a DatasetProvider');
    }
    return context;
};
