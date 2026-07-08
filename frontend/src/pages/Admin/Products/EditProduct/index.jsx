import { useParams } from 'react-router-dom';
import ProductWizard from '../components/ProductWizard/index.jsx';

export default function EditProduct() {
  const { id } = useParams();
  return <ProductWizard mode="edit" productId={id} />;
}
