import { Parser } from 'json2csv';

export const exportCSV = async (req, res) => {
    const { data, filename } = req.body;
    try {
        if (!data || !Array.isArray(data)) return res.status(400).json({ message: 'Invalid data for export' });

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(data);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename || 'export'}.csv`);
        res.status(200).send(csv);
    } catch (e) {
        res.status(500).json({ message: 'Failed to export CSV' });
    }
};
