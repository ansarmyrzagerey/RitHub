import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreateStudyWizard } from '../components/studies';
import { Breadcrumb } from '../components';
import { ROUTES } from '../constants';

const CreateStudy = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const handleComplete = () => {
    // Navigate back to studies page after successful creation
    navigate(ROUTES.STUDIES);
  };

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Studies', path: ROUTES.STUDIES },
    { label: isEditing ? 'Edit Study' : 'Create Study' },
  ];

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <CreateStudyWizard onComplete={handleComplete} studyId={id} />
    </>
  );
};

export default CreateStudy;
