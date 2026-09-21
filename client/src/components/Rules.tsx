import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GORILLA_META } from '../meta';
import { GORILLAS } from '../../../shared/types';

export function RulesButton({ className = 'btn ghost small' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        📖 Luật chơi
      </button>
      <AnimatePresence>{open && <RulesModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal rules"
        initial={{ y: 40, scale: 0.94 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.94 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <h2>Luật chơi Durian</h2>
        <p>
          Bạn là nhân viên cửa hàng trái cây. Quản lý rất dễ nổi giận: nhận quá nhiều đơn mà bị phát hiện, hoặc gọi quản lý
          quá sớm, bạn sẽ bị mắng. Ai gom đủ <b>7 điểm giận dữ</b> sẽ bị đuổi việc và ván kết thúc.
        </p>
        <h3>Kho hàng</h3>
        <p>
          Mỗi người có một thẻ trên giá gỗ, quay về phía người khác: <b>bạn thấy thẻ của mọi người trừ thẻ của mình</b>. Tổng
          trái cây trên tất cả các thẻ (cả hai nửa) là kho hàng chung. Chơi 2 người thì có thêm một thẻ ngửa giữa bàn.
        </p>
        <h3>Đến lượt, chọn một trong hai</h3>
        <ul>
          <li>
            <b>Nhận đơn:</b> rút một thẻ và chọn một trong hai nửa làm đơn hàng. Nửa được chọn quay về phía ✓ trên bảng.
          </li>
          <li>
            <b>Gọi quản lý (rung chuông):</b> nếu bạn nghĩ người vừa đi đã làm tổng đơn vượt kho. Hết bài thì bắt buộc gọi.
          </li>
        </ul>
        <h3>Khi quản lý đến</h3>
        <p>
          So sánh từng loại trái: nếu có loại nào <b>đơn &gt; kho</b> thì người bị gọi nhận token. Nếu không thì người gọi
          nhận token. Token nhận được luôn là token có giá trị thấp nhất còn lại. Vòng mới bắt đầu từ người bên trái người bị
          phạt.
        </p>
        <h3>Khỉ đột</h3>
        <div className="rules-gorillas">
          {GORILLAS.map((g) => (
            <div key={g}>
              <img src={GORILLA_META[g].img} alt={GORILLA_META[g].name} />
              <b>{GORILLA_META[g].name}</b>
              <span>Trong kho: {GORILLA_META[g].inventory.toLowerCase()}.</span>
            </div>
          ))}
        </div>
        <p>
          Rút khỉ đột khi nhận đơn: chọn một đơn trước đó và <b>lật ngược</b> nó (đổi sang nửa còn lại). Đơn đã bị lật thì
          không thể lật lại.
        </p>
        <h3>Kết thúc</h3>
        <p>Khi có người đạt 7 điểm trở lên, ai ít điểm nhất thắng. Hòa thì ai ít token hơn thắng.</p>
        <p className="muted">
          Lưu ý: nhà sản xuất chưa công bố chính xác 28 thẻ trái cây. Bộ bài ở đây được thiết kế theo đúng quy tắc trong sách
          luật.
        </p>
      </motion.div>
    </motion.div>
  );
}
