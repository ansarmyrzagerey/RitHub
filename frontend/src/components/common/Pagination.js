import React from 'react';
import { Box, Button, IconButton, Typography, Select, MenuItem, FormControl } from '@mui/material';
import { ChevronLeft, ChevronRight, FirstPage, LastPage } from '@mui/icons-material';

/**
 * Reusable Pagination Component
 * @param {number} totalItems - Total number of items
 * @param {number} itemsPerPage - Items to show per page
 * @param {number} currentPage - Current page number (1-indexed)
 * @param {function} onPageChange - Callback when page changes
 * @param {function} onItemsPerPageChange - Callback when items per page changes
 */
const Pagination = ({
    totalItems,
    itemsPerPage = 50,
    currentPage = 1,
    onPageChange,
    onItemsPerPageChange
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalItems === 0) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const handleFirstPage = () => onPageChange(1);
    const handlePrevPage = () => onPageChange(Math.max(1, currentPage - 1));
    const handleNextPage = () => onPageChange(Math.min(totalPages, currentPage + 1));
    const handleLastPage = () => onPageChange(totalPages);

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxPagesToShow = 7;

        if (totalPages <= maxPagesToShow) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show first, last, current, and adjacent pages with ellipsis
            if (currentPage <= 4) {
                // Near start: 1 2 3 4 5 ... last
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('ellipsis1');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                // Near end: 1 ... last-4 last-3 last-2 last-1 last
                pages.push(1);
                pages.push('ellipsis1');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                // Middle: 1 ... current-1 current current+1 ... last
                pages.push(1);
                pages.push('ellipsis1');
                pages.push(currentPage - 1);
                pages.push(currentPage);
                pages.push(currentPage + 1);
                pages.push('ellipsis2');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            py: 2,
            px: 1
        }}>
            {/* Items info */}
            <Typography variant="body2" color="text.secondary">
                Showing {startItem}-{endItem} of {totalItems} items
            </Typography>

            {/* Page controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* First page */}
                <IconButton
                    size="small"
                    onClick={handleFirstPage}
                    disabled={currentPage === 1}
                    aria-label="First page"
                >
                    <FirstPage />
                </IconButton>

                {/* Previous page */}
                <IconButton
                    size="small"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                >
                    <ChevronLeft />
                </IconButton>

                {/* Page numbers */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {pageNumbers.map((page, index) => {
                        if (typeof page === 'string') {
                            // Ellipsis
                            return (
                                <Typography
                                    key={page}
                                    variant="body2"
                                    sx={{ px: 1, py: 0.5 }}
                                >
                                    ...
                                </Typography>
                            );
                        }

                        return (
                            <Button
                                key={page}
                                size="small"
                                variant={page === currentPage ? 'contained' : 'outlined'}
                                onClick={() => onPageChange(page)}
                                sx={{
                                    minWidth: 36,
                                    height: 36,
                                    p: 0
                                }}
                            >
                                {page}
                            </Button>
                        );
                    })}
                </Box>

                {/* Next page */}
                <IconButton
                    size="small"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                >
                    <ChevronRight />
                </IconButton>

                {/* Last page */}
                <IconButton
                    size="small"
                    onClick={handleLastPage}
                    disabled={currentPage === totalPages}
                    aria-label="Last page"
                >
                    <LastPage />
                </IconButton>
            </Box>

            {/* Items per page selector */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Items per page:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 70 }}>
                    <Select
                        value={itemsPerPage}
                        onChange={(e) => {
                            onItemsPerPageChange(e.target.value);
                            onPageChange(1); // Reset to first page when changing items per page
                        }}
                    >
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                        <MenuItem value={200}>200</MenuItem>
                    </Select>
                </FormControl>
            </Box>
        </Box>
    );
};

export default Pagination;
