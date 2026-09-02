import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Trash2, UserPlus, CheckCircle2, PackagePlus, Loader2 } from 'lucide-react';
import { fmtMoney, todayInputValue } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Empty } from '@/components/shop/Empty';
import { QuickAddProductModal } from '@/components/shop/QuickAddProductModal';
import * as suppliersApi from '@/services/api/suppliers';
import * as productsApi from '@/services/api/products';
import * as purchasesApi from '@/services/api/purchases';
import { inp, btn, btnOutline, thCls, tdCls } from '@/components/shop/styles';

// Same reasoning as the customer picker in POS: one batch instead of an
// async-searchable picker, for these two plain <select> dropdowns.
const SUPPLIER_LIMIT = 100;
const PRODUCT_PICKER_LIMIT = 100;

export function PurchasesPage() {
  const navigate = useNavigate();

  const [suppliersList, setSuppliersList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '' });
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [lines, setLines] = useState([]);
  const [pick, setPick] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidInput, setPaidInput] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    suppliersApi.listSuppliers({ limit: SUPPLIER_LIMIT })
      .then((res) => setSuppliersList(res.data))
      .catch((err) => toast.error(err.message || 'تعذر تحميل الموردين'));
    productsApi.listProducts({ limit: PRODUCT_PICKER_LIMIT })
      .then((res) => setProductsList(res.data))
      .catch((err) => toast.error(err.message || 'تعذر تحميل المنتجات'));
  }, []);

  const total = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);
  const paid = paymentMethod === 'cash' ? total : Math.min(total, Number(paidInput) || 0);
  const remaining = Math.max(0, total - paid);

  const addLine = (pid) => {
    if (!pid) return;
    const p = productsList.find((x) => x._id === pid);
    if (!p) return;

    if (lines.some((l) => l.productId === pid)) {
      toast.info('المنتج مضاف بالفعل في الفاتورة');
      setPick('');
      return;
    }

    setLines([
      ...lines,
      {
        productId: p._id,
        name: p.name,
        code: p.code,
        price: p.purchasePrice || 0,
        quantity: 1,
      },
    ]);
    setPick('');
  };

  const updateLine = (id, k, v) => {
    const val = Math.max(0, Number(v) || 0);
    setLines(lines.map((l) => (l.productId === id ? { ...l, [k]: val } : l)));
  };

  // Product created on the fly from within the purchase screen. We build the
  // line from the product object the API just returned directly (rather
  // than re-reading productsList, which hasn't refetched yet) so it's
  // usable in this same purchase immediately, and also add it to the local
  // picker list so it shows up there too.
  const handleProductCreated = (product) => {
    setProductsList((prev) => [product, ...prev]);
    if (lines.some((l) => l.productId === product._id)) return;
    setLines((prev) => [
      ...prev,
      { productId: product._id, name: product.name, code: product.code, price: product.purchasePrice || 0, quantity: 1 },
    ]);
    setPick('');
  };

  const saveNewSupplier = async () => {
    if (!newSupplier.name.trim()) {
      toast.error('يرجى إدخال اسم المورد');
      return;
    }
    setSavingSupplier(true);
    try {
      const res = await suppliersApi.createSupplier(newSupplier);
      setSuppliersList((prev) => [res.data, ...prev]);
      toast.success('تمت إضافة المورد بنجاح');
      setSupplierId(res.data._id);
      setShowNewSupplier(false);
      setNewSupplier({ name: '', phone: '', address: '' });
    } catch (err) {
      toast.error(err.message || 'تعذر إضافة المورد');
    } finally {
      setSavingSupplier(false);
    }
  };

  const save = async () => {
    if (!supplierId) {
      toast.error('يرجى اختيار المورد أولاً');
      return;
    }

    if (lines.length === 0) {
      toast.error('يرجى إضافة منتج واحد على الأقل للعملية');
      return;
    }

    setSaving(true);
    try {
      await purchasesApi.createPurchase({
        supplierId,
        paymentMethod,
        paid,
        date,
        notes,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          price: Number(l.price),
        })),
      });
      toast.success('تم تسجيل عملية الشراء بنجاح');
      setLines([]);
      setSupplierId('');
      setPaidInput('');
      setNotes('');
      setPaymentMethod('cash');
      navigate('/purchases/history');
    } catch (err) {
      toast.error(err.message || 'تعذر تسجيل عملية الشراء');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Helmet>
        <title>عملية شراء جديدة — نظام إدارة المحل</title>
        <meta name="description" content="تسجيل فاتورة شراء جديدة من مورد" />
      </Helmet>

      {/* بيانات المورد والتاريخ */}
      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-2">
        <div>
          <Field label="المورد">
            <select
              className={inp}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">اختر المورد...</option>
              {suppliersList.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} {s.phone ? `— ${s.phone}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {!showNewSupplier ? (
            <button
              onClick={() => setShowNewSupplier(true)}
              className="mt-2.5 flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              <UserPlus size={15} /> إضافة مورد جديد
            </button>
          ) : (
            <div className="mt-3 grid gap-2.5 rounded-lg border bg-muted/40 p-3">
              <span className="text-xs font-bold text-foreground">بيانات المورد الجديد:</span>
              <input
                className={inp}
                placeholder="الاسم *"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
              />
              <input
                className={inp}
                placeholder="رقم الهاتف"
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
              />
              <input
                className={inp}
                placeholder="العنوان"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
              />
              <div className="flex gap-2 pt-1">
                <button className={`${btn} text-xs py-1.5`} onClick={saveNewSupplier} disabled={savingSupplier}>
                  {savingSupplier && <Loader2 size={13} className="animate-spin" />} حفظ المورد
                </button>
                <button
                  className={`${btnOutline} text-xs py-1.5`}
                  onClick={() => setShowNewSupplier(false)}
                  disabled={savingSupplier}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <Field label="تاريخ العملية">
            <input
              type="date"
              className={inp}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="ملاحظات">
            <input
              className={inp}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية على الفاتورة..."
            />
          </Field>
        </div>
      </div>

      {/* إضافة المنتجات والجدول */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <Field label="إضافة منتج للعملية">
          <div className="flex gap-2">
            <select className={`${inp} flex-1`} value={pick} onChange={(e) => addLine(e.target.value)}>
              <option value="">اختر منتجاً لإضافته للقائمة...</option>
              {productsList
                .filter((p) => !lines.some((l) => l.productId === p._id))
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} {p.code ? `(${p.code})` : ''} — بسعر {fmtMoney(p.purchasePrice || 0)}
                  </option>
                ))}
            </select>
            <button type="button" className={`${btnOutline} shrink-0`} onClick={() => setShowAddProduct(true)} title="إضافة منتج جديد غير موجود">
              <PackagePlus size={16} /> <span className="hidden sm:inline">منتج جديد</span>
            </button>
          </div>
        </Field>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className={thCls}>المنتج</th>
                <th className={thCls}>الكمية</th>
                <th className={thCls}>سعر الشراء</th>
                <th className={thCls}>الإجمالي</th>
                <th className={`${thCls} w-10`}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className={`${tdCls} font-medium`}>
                    {l.name} {l.code && <span className="text-xs font-mono text-muted-foreground">({l.code})</span>}
                  </td>
                  <td className={tdCls}>
                    <input
                      type="number"
                      min="1"
                      className="h-9 w-20 rounded-lg border bg-background px-2 font-mono text-sm"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.productId, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className={tdCls}>
                    <input
                      type="number"
                      min="0"
                      className="h-9 w-28 rounded-lg border bg-background px-2 font-mono text-sm"
                      value={l.price}
                      onChange={(e) => updateLine(l.productId, 'price', e.target.value)}
                    />
                  </td>
                  <td className={`${tdCls} font-bold font-mono`}>
                    {fmtMoney((Number(l.price) || 0) * (Number(l.quantity) || 0))}
                  </td>
                  <td className={tdCls}>
                    <button
                      onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))}
                      className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                      title="حذف المنتج"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length === 0 && <Empty text="لم تتم إضافة أية منتجات بعد إلى الفاتورة" />}
        </div>
      </div>

      {/* تفاصيل الدفع والحفظ */}
      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="grid gap-3">
          <label className="text-sm font-semibold">طريقة الدفع</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('cash');
                setPaidInput('');
              }}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                paymentMethod === 'cash'
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-muted'
              }`}
            >
              نقدي (كاش)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('credit')}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                paymentMethod === 'credit'
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-muted'
              }`}
            >
              آجل / جزئي
            </button>
          </div>

          {paymentMethod === 'credit' && (
            <Field label="المبلغ المدفوع حاصلاً">
              <input
                type="number"
                min="0"
                max={total}
                className={`${inp} font-mono`}
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                placeholder="0"
              />
            </Field>
          )}
        </div>

        <div className="grid content-between gap-3">
          <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">إجمالي الفاتورة:</span>
              <b className="text-lg font-mono text-primary">{fmtMoney(total)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المدفوع:</span>
              <b className="font-mono text-emerald-600">{fmtMoney(paid)}</b>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">المتبقي (دين للمورد):</span>
              <b className={`font-mono ${remaining > 0 ? 'text-destructive font-bold' : ''}`}>
                {fmtMoney(remaining)}
              </b>
            </div>
          </div>

          <button
            onClick={save}
            disabled={lines.length === 0 || saving}
            className={`${btn} h-12 w-full text-base font-bold gap-2`}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} حفظ عملية الشراء
          </button>
        </div>
      </div>

      <QuickAddProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onCreated={handleProductCreated}
      />
    </div>
  );
}

export default PurchasesPage;
