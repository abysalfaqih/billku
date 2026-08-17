/**
 * Patch untuk node-routeros@1.6.x
 *
 * RouterOS 7.18+ memperkenalkan reply word baru "!empty" untuk command
 * yang tidak punya data untuk dibalas (mis. /ip/pool/print dengan filter
 * yang tidak match). Library node-routeros (sudah discontinued/archived)
 * hanya mengenal !re / !done / !trap, sehingga reply !empty membuatnya
 * throw RosException('UNKNOWNREPLY') di dalam event-emitter — di luar
 * konteks promise/try-catch — dan menjadi uncaught exception.
 *
 * Fix ini menormalkan reply "!empty" menjadi "!done" SEBELUM diproses
 * oleh Channel, sehingga request selesai normal dengan data kosong,
 * persis seperti perilaku !done tanpa data.
 *
 * PENTING: import file ini SEKALI saja, paling awal, sebelum ada
 * koneksi Mikrotik dibuat di mana pun (taruh di main.ts).
 */
import { Channel } from 'node-routeros/dist/Channel';
import { Receiver } from 'node-routeros/dist/connector/Receiver';

const channelProto = Channel.prototype as any;

if (!channelProto.__emptyReplyPatched) {
  const originalProcessPacket = channelProto.processPacket;

  channelProto.processPacket = function (packet: string[]) {
    if (packet[0] === '!empty') {
      packet[0] = '!done';
    }
    return originalProcessPacket.call(this, packet);
  };

  channelProto.__emptyReplyPatched = true;
}

/**
 * RosException('UNREGISTEREDTAG')
 *
 * Kadang Receiver menerima sisa data untuk sebuah tag yang channel-nya
 * sudah !done/!empty dan sudah ditutup (tag sudah dihapus dari map).
 * Ini race condition internal di parser Receiver (bukan sesuatu yang bisa
 * dikontrol dari sisi pemanggil), dan node-routeros meresponnya dengan
 * throw synchronous di tengah socket data-handler -> uncaught exception.
 *
 * Data "yatim" ini aman dibuang; tidak perlu bikin seluruh proses crash.
 */
const receiverProto = Receiver.prototype as any;

if (!receiverProto.__unregisteredTagPatched) {
  const originalSendTagData = receiverProto.sendTagData;

  receiverProto.sendTagData = function (currentTag: string) {
    const tag = this.tags.get(currentTag);
    if (!tag) {
      // buang data yatim, reset state seperti cleanUp() internal, jangan throw
      this.currentPacket = [];
      this.currentTag = null;
      this.currentReply = null;
      return;
    }
    return originalSendTagData.call(this, currentTag);
  };

  receiverProto.__unregisteredTagPatched = true;
}