/**
 * Author: meimeidev
 */

!function($){
    var MMGrid = function (element, options) {
        this._id = (((1 + Math.random()) * 0x10000) | 0).toString(16);
        this._loadCount = 0;
        this.opts = options;
        this._initLayout($(element));
        this._initHead();
        this._initOptions();
        this._initEvents();
        this._setColsWidth();
        if(this.opts.fullWidthRows){
            this._fullWidthRows();
        }

        //初始化插件
        for(var i=0; i< this.opts.plugins.length; i++){
            var plugin = this.opts.plugins[i];
            plugin.init($.extend(element, this));
        }

        if(options.autoLoad){
            var that = this;
            setTimeout(function(){
                if(options.url){
                    that.load();
                }else{
                    that.load(options.items);
                }
            },0); //chrome style problem
        }

    };

    //see: http://tanalin.com/en/articles/ie-version-js/
    var browser = function(){
        var isIE=!!window.ActiveXObject;
        var isIE10 = isIE && !!window.atob;
        var isIE9 = isIE && document.addEventListener && !window.atob;
        var isIE8 = isIE && document.querySelector && !document.addEventListener;
        var isIE7 = isIE && window.XMLHttpRequest && !document.querySelector;
        var isIE6 = isIE && !window.XMLHttpRequest;

        return {
            isIE: isIE
            , isIE6: isIE6
            , isIE7: isIE7
            , isIE8: isIE8
            , isIE9: isIE9
            , isIE10: isIE10
        };
    }();

    MMGrid.prototype = {
        _initLayout: function($el){
            var $elParent = $el.parent();
            var elIndex = $el.index();

            var mmGrid = [
                '<div class="mmGrid">',
                    '<style></style>',
                    '<div class="mmg-headWrapper">',
                        '<table class="mmg-head" cellspacing="0"></table>',
                    '</div>',
                    '<div class="mmg-colResizePointer"></div>',
                    '<div class="mmg-colResizePointer-before"></div>',
                    '<div class="mmg-backboard">',
                        '<a class="mmg-btnBackboardUp"></a>',
                    '</div>',
                    '<div class="mmg-bodyWrapper"></div>',
                    '<a class="mmg-btnBackboardDn"></a>',
                    '<div class="mmg-message">'+ this.opts.noDataText +'</div>',
                    '<div class="mmg-mask mmg-transparent"></div>',
                    '<div class="mmg-loading">',
                        '<div class="mmg-loadingImg"></div>',
                        '<div class="mmg-loadingText">'+ this.opts.loadingText +'</div>',
                    '</div>',

                '</div>'
            ];
            //fix in IE7,IE6
            if(browser.isIE7 || browser.isIE6){
                $el.prop('cellspacing',0);
            }


            //cached object
            var $mmGrid = $(mmGrid.join(''));
            this.$mmGrid = $mmGrid;
            this.$style = $mmGrid.find('style');
            this.$headWrapper = $mmGrid.find('.mmg-headWrapper');
            this.$head = $mmGrid.find('.mmg-head');
            this.$backboard = $mmGrid.find('.mmg-backboard');
            this.$bodyWrapper = $mmGrid.find('.mmg-bodyWrapper');
            this.$body = $el.removeAttr("style").addClass('mmg-body');
            this._insertEmptyRow();
            this.$body.appendTo(this.$bodyWrapper);


            //放回原位置
            if(elIndex === 0 || $elParent.children().length == 0){
                $elParent.prepend(this.$mmGrid);
            }else{
                $elParent.children().eq(elIndex-1).after(this.$mmGrid);
            }

            var opts = this.opts;
            // fix in ie6
            if(browser.isIE6 && (!opts.width || opts.width === 'auto')){
                $mmGrid.width('100%');
                $mmGrid.width($mmGrid.width() - ($mmGrid.outerWidth(true) - $mmGrid.width()));
            }else{
                $mmGrid.width(opts.width);
            }

            if(browser.isIE6 && (!opts.height || opts.height === 'auto')){
                $mmGrid.height('100%');
                $mmGrid.height($mmGrid.height() - ($mmGrid.outerHeight(true) - $mmGrid.height()));
            }else{
                $mmGrid.height(opts.height);
            }

            if(opts.checkCol){
                var chkHtml = opts.multiSelect ?  '<input type="checkbox" class="checkAll" >'
                    : '<input type="checkbox" disabled="disabled" class="checkAll">';
                opts.cols.unshift({title:chkHtml,width: 20, align: 'center' ,lockWidth: true, checkCol: true, renderer:function(){
                    return '<input type="checkbox" class="mmg-check">';
                }});
            }

            if(opts.indexCol){
                opts.cols.unshift({title:'#',width: opts.indexColWidth, align: 'center' ,lockWidth: true, indexCol:true, renderer:function(val,item,rowIndex){
                    return '<label class="mmg-index">' + (rowIndex+1) + '</label>';
                }});
            }
        }

        , _initHead: function(){
            var opts = this.opts;
            var $head = this.$head;

            if(opts.cols){
                var theadHtmls = ['<thead>'];

                for(var colIndex=0; colIndex< opts.cols.length; colIndex++){
                    var col = opts.cols[colIndex];
                    theadHtmls.push('<th class="');
                    theadHtmls.push(this._genColClass(colIndex));
                    theadHtmls.push(' nowrap">');
                    theadHtmls.push('<div class="mmg-titleWrapper" >');
                    theadHtmls.push('<span class="mmg-title ');
                    if(col.sortable) theadHtmls.push('mmg-canSort ');
                    theadHtmls.push('">');
                    theadHtmls.push(col.title);
                    theadHtmls.push('</span><div class="mmg-sort"></div>');
                    if(!col.lockWidth) theadHtmls.push('<div class="mmg-colResize"></div>');
                    theadHtmls.push('</div></th>');
                }

                theadHtmls.push('</thead>');
                $head.html(theadHtmls.join(''));
            }

            $.each($head.find('th'),function(index){
                if(!opts.cols[index].width){
                    opts.cols[index].width = 100;
                }
                $.data(this,'col-width',opts.cols[index].width);
            });

            var $mmGrid = this.$mmGrid;
            var $headWrapper = this.$headWrapper;
            var $bodyWrapper = this.$bodyWrapper;
            $bodyWrapper.height($mmGrid.height() - $headWrapper.outerHeight(true));


            //初始化排序状态
            if(opts.sortName){
                var $ths = $head.find('th');
                for(var colIndex=0; colIndex< opts.cols.length; colIndex++){
                    var col = opts.cols[colIndex];
                    if(col.sortName === opts.sortName || col.name === opts.sortName){
                        var $th= $ths.eq(colIndex);
                        $.data($th.find('.mmg-title')[0],'sortStatus',opts.sortStatus);
                        $th.find('.mmg-sort').addClass('mmg-'+opts.sortStatus);
                    }
                }
            }
        }

        , _initOptions: function(){
            var opts = this.opts;
            var $mmGrid = this.$mmGrid;
            var $headWrapper = this.$headWrapper;
            var $backboard = this.$backboard;
            $mmGrid.find('a.mmg-btnBackboardDn').css({
                'top': $headWrapper.outerHeight(true)
            }).slideUp('fast');

            if(opts.cols){
                var bbHtml = ['<h1>显示列</h1>'];
                for(var colIndex=0; colIndex<opts.cols.length; colIndex++){
                    bbHtml.push('<label ');
                    if(opts.cols[colIndex].checkCol || opts.cols[colIndex].indexCol){
                        bbHtml.push('style="display:none;" ');
                    }
                    var col = opts.cols[colIndex];
                    bbHtml.push('><input type="checkbox"  ');
                    if(!col.hidden) bbHtml.push('checked="checked"');
                    if(col.lockDisplay) bbHtml.push(' disabled="disabled"');
                    bbHtml.push('/><span>');
                    if(col.title){
                        bbHtml.push(col.title);
                    }else{
                        bbHtml.push('未命名');
                    }

                    bbHtml.push('</span></label>');
                }
                $backboard.append($(bbHtml.join('')));
            }
        }

        , _initEvents: function(){
            var that = this;
            var opts = this.opts;
            var $mmGrid = this.$mmGrid;
            var $headWrapper = this.$headWrapper;
            var $head = this.$head;
            var $bodyWrapper = this.$bodyWrapper;
            var $body = this.$body;
            var $backboard = this.$backboard;

            //调整浏览器
            if(opts.width === 'auto' || opts.height === 'auto' || (typeof opts.width === 'string' && opts.width.indexOf('%') === opts.width.length-1) ||
                typeof opts.height === 'string' && opts.height.indexOf('%') === opts.height.length-1){
                $(window).on('resize', function(){
                    that.resize();
                });
            }

            //滚动条事件
            $bodyWrapper.on('scroll', function(){
                $head.css('left',- $(this).scrollLeft());
            });

            //向下按钮
            var $btnBackboardDn = $mmGrid.find('a.mmg-btnBackboardDn').on('click', function(){
                $backboard.height($mmGrid.height() - $headWrapper.outerHeight(true));
                $backboard.slideDown();
                $btnBackboardDn.slideUp('fast');
                that._hideNoData();
            });
            $body.on('mouseenter', function(){
                $btnBackboardDn.slideUp('fast');
            });
            $mmGrid.on('mouseleave', function(){
                $btnBackboardDn.slideUp('fast');
            });
            $headWrapper.on('mouseenter',function(){
                if($backboard.is(':hidden')){
                    $btnBackboardDn.slideDown('fast');
                }
            });
            //向上按钮
            $mmGrid.find('a.mmg-btnBackboardUp').on('click', function(){
                $backboard.slideUp().queue(function(next){
                    if(!that.rowsLength() || (that.rowsLength() === 1 && $body.find('tr.emptyRow').length === 1)){
                        that._showNoData();
                    }
                    next();
                });
            });

            //隐藏列
            $backboard.on('click', ':checkbox', function(){
                var index = $backboard.find('label').index($(this).parent());
                //最后一个不隐藏
                var last = 1;
                if(opts.checkCol){
                    last = last + 1;
                }
                if(opts.indexCol){
                    last = last + 1;
                }
                if($backboard.find('label :checked').length < last){
                    this.checked = true;
                    return;
                }
                if(this.checked){
                    opts.cols[index].hidden = false;
                    that._setColsWidth();
                }else{
                    opts.cols[index].hidden = true;
                    that._setColsWidth();
                }
            });

            //排序事件
            $head.on('click', '.mmg-title', function(){
                var $this = $(this);
                var $titles =  $head.find('.mmg-title');
                //当前列不允许排序
                if(!opts.cols[$titles.index($this)].sortable){
                    return;
                }
                //取得当前列下一个排序状态
                var sortStatus = $.data(this, 'sortStatus') === 'asc' ? 'desc' : 'asc';
                //清除排序状态
                $.each($titles, function(){
                    $.removeData(this,'sortStatus');
                });
                $head.find('.mmg-sort').removeClass('mmg-asc').removeClass('mmg-desc');
                //设置当前列排序状态
                $.data(this, 'sortStatus', sortStatus);
                $this.siblings('.mmg-sort').addClass('mmg-'+sortStatus);

                if(opts.url && opts.remoteSort){
                    that.load()
                }else{
                    that._nativeSorter($titles.index($this), sortStatus);
                    that._setStyle();
                }
            }).on('mousedown', '.mmg-colResize', function(e){
                //调整列宽
                var $resize = $(this);
                var start = e.pageX;
                var $colResizePointer = $mmGrid.find('.mmg-colResizePointer')
                    .css('left', e.pageX - $headWrapper.offset().left).show();

                var scrollLeft = $head.position().left;
                var $colResizePointerBefore = $mmGrid.find('.mmg-colResizePointer-before')
                    .css('left', $resize.parent().parent().position().left + scrollLeft).show();
                //取消文字选择
                document.selection && document.selection.empty && ( document.selection.empty(), 1)
                || window.getSelection && window.getSelection().removeAllRanges();
                document.body.onselectstart = function () {
                    return false;
                };
                $headWrapper.css('-moz-user-select','none');

                $mmGrid.on('mousemove', function(e){
                    $colResizePointer.css('left', e.pageX - $headWrapper.offset().left);
                }).on('mouseup', function(e){
                    //改变宽度
                    var $th = $resize.parent().parent();
                    var width = $th.width() + e.pageX - start;
                    $.data($th[0], 'col-width', width);
                    that._setColsWidth();
                    $headWrapper.mouseleave();
                }).on('mouseleave',function(){
                    $mmGrid.off('mouseup').off('mouseleave').off('mousemove');
                    $colResizePointer.hide();
                    $colResizePointerBefore.hide();
                    document.body.onselectstart = function(){
                        return true;//开启文字选择
                    };
                    $headWrapper.css('-moz-user-select','text');
                });
            });

            //选中事件
            var $body = this.$body;
            $body.on('click','td',function(){
                var $this = $(this);


                that.$body.triggerHandler('rowSelected', [$.data($this.parent()[0], 'item'), $this.parent().index(), $this.index()]);
                if(!$this.parent().hasClass('selected')){
                    that.select($this.parent().index());
                }
            });

            $body.on('click','tr > td .mmg-check',function(e){
                e.stopPropagation();
                var $this = $(this);
                if(this.checked){
                    that.select($this.parent().parent().parent().index());
                }else{
                    that.deselect($this.parent().parent().parent().index());
                }
            });

            //checkbox列
            if(opts.checkCol){
                $head.find('th .checkAll').on('click', function(){
                    if(this.checked){
                        that.select('all');
                    }else{
                        that.deselect('all');
                    }
                });
            }

            //IE6不支持hover
            if (browser.isIE6){
                $body.on('mouseenter','tr', function () {
                    $(this).toggleClass('hover');
                }).on('mouseleave','tr', function () {
                    $(this).toggleClass('hover');
                });
            };


        }

        , _rowHtml: function(item, rowIndex){
            var opts = this.opts;

            if($.isPlainObject(item)){
                var trHtml = [];
                trHtml.push('<tr>');
                for(var colIndex=0; colIndex < opts.cols.length; colIndex++){
                    var col = opts.cols[colIndex];
                    trHtml.push('<td class="');
                    trHtml.push(this._genColClass(colIndex));
                    if(opts.nowrap){
                        trHtml.push(' nowrap');
                    }
                    trHtml.push('"><span class="');
                    if(opts.nowrap){
                        trHtml.push('nowrap');
                    }
                    trHtml.push('">');
                    if(col.renderer){
                        trHtml.push(col.renderer(item[col.name],item,rowIndex));
                    }else{
                        trHtml.push(item[col.name]);
                    }

                    trHtml.push('</span></td>');
                };
                trHtml.push('</tr>');
                return trHtml.join('');
            }
        }

        , _populate: function(items){
            var opts = this.opts;
            var $body = this.$body;

            this._hideNoData();
            if(items && items.length !== 0 && opts.cols){

                var tbodyHtmls = [];
                tbodyHtmls.push('<tbody>');
                for(var rowIndex=0; rowIndex < items.length; rowIndex++){
                    var item = items[rowIndex];
                    tbodyHtmls.push(this._rowHtml(item, rowIndex));
                }
                tbodyHtmls.push('</tbody>');
                $body.empty().html(tbodyHtmls.join(''));
                var $trs = $body.find('tr');
                for(var rowIndex=0; rowIndex < items.length; rowIndex++){
                    $.data($trs.eq(rowIndex)[0],'item',items[rowIndex]);
                }
            }else{
                this._insertEmptyRow();
                this._showNoData();
            }
            this._setStyle();

            if(opts.fullWidthRows && this._loadCount <= 1){
                this._fullWidthRows();
            }

            this._hideLoading();
        }

        , _insertEmptyRow: function(){
            var $body = this.$body;
            $body.empty().html('<tbody><tr class="emptyRow"><td  style="border: 0px;background: none;">&nbsp;</td></tr></tbody>');
        }
        , _removeEmptyRow: function(){
            var $body = this.$body;
            $body.find('tr.emptyRow').remove();
        }

        /* 生成列类 */
        , _genColClass: function(colIndex){
            return 'mmg'+ this._id +'-col'+colIndex;
        }

        , _setStyle: function(){
            var $head = this.$head;
            var $ths = $head.find('th');
            var $body = this.$body;

            //head
            $ths.eq(0).addClass('first');
            $ths.eq(-1).addClass('last');
            //body
            $body.find('tr,td').removeClass('even')
                .removeClass('colSelected').removeClass('colSelectedEven');

            $body.find('tr:odd').addClass('even');

            var sortIndex = $head.find('.mmg-title').index($head.find('.mmg-title').filter(function(){
                return $.data(this,'sortStatus') === 'asc' || $(this).data('sortStatus') === 'desc';
            }));

            $body.find('tr > td:nth-child('+(sortIndex+1)+')').addClass('colSelected')
                .filter(':odd').addClass('colSelectedEven');

        }
        , _setColsWidth: function(){
            var opts = this.opts;
            var $style = this.$style;
            var $head = this.$head;
            var $ths = $head.find('th');
            var $bodyWrapper = this.$bodyWrapper;
            var $body = this.$body;

            var scrollTop = $bodyWrapper.scrollTop();
            var scrollLeft = $head.position().left;

            $bodyWrapper.width(9999);
            $body.width('auto');
            var styleText = [];
            for(var colIndex=0; colIndex<$ths.length; colIndex++){
                var $th = $ths.eq(colIndex);
                styleText.push('.mmGrid .'+this._genColClass(colIndex) + ' {');
                var width = $.data($th[0],'col-width');
                styleText.push('width: '+ width +'px;');
                styleText.push('max-width: '+ width +'px;');
                if(opts.cols[colIndex].align){
                    styleText.push('text-align: '+opts.cols[colIndex].align+';');
                }
                if(opts.cols[colIndex].hidden){
                    styleText.push('display: none; ');
                }
                styleText.push(' }');
            }

            $body.detach();
            try{
                $style.text(styleText.join(''));
            }catch(error){
                $style[0].styleSheet.cssText = styleText.join('');//IE fix
            }
            $body.width($head.width());
            $bodyWrapper.width('100%');
            $bodyWrapper.append($body);

            //调整滚动条

            $bodyWrapper.scrollLeft(-scrollLeft);
            if($bodyWrapper.scrollLeft() === 0){
                $head.css('left', 0);
            }

            $bodyWrapper.scrollTop(scrollTop);
        }
        , _fullWidthRows: function(){
            var opts = this.opts;
            var $bodyWrapper = this.$bodyWrapper;
            var $mmGrid = this.$mmGrid;
            var $head = this.$head;
            var scrollWidth = $bodyWrapper.width() - $bodyWrapper[0].clientWidth;

            if(scrollWidth && browser.isIE){
                scrollWidth = scrollWidth + 1;
            }

            var fitWidth =  $mmGrid.width() - $head.width() - scrollWidth;
            if(fitWidth < -20){
                return;
            }

            var thsArr = [];
            var $ths = $head.find('th');
            for(var i=0; i< opts.cols.length; i++){
                var col = opts.cols[i];
                var $th = $ths.eq(i);
                if(!col.lockWidth && $th.is(':visible')){
                    thsArr.push($th);
                }
            }

            var increaseWidth =  Math.floor(fitWidth / thsArr.length);
            var maxColWidthIndex = 0;
            for(var i=0; i< thsArr.length; i++){
                var $th = thsArr[i];
                var colWidth = $.data($th[0], 'col-width') + increaseWidth;
                $.data($th[0], 'col-width', colWidth);

                var maxColWidth = $.data(thsArr[maxColWidthIndex][0], 'col-width');
                if(maxColWidth < colWidth){
                    maxColWidthIndex = i;
                }
            }

            var remainWidth =  fitWidth -  increaseWidth * thsArr.length;
            var maxColWidth = $.data(thsArr[maxColWidthIndex][0], 'col-width');
            $.data(thsArr[maxColWidthIndex][0], 'col-width', maxColWidth + remainWidth);
            this._setColsWidth();
        }


        , _showLoading: function(){
            var $mmGrid = this.$mmGrid;
            $mmGrid.find('.mmg-mask').show();

            var $loading = $mmGrid.find('.mmg-loading');
            $loading.css({
                'left': ($mmGrid.width() - $loading.width()) / 2,
                'top': ($mmGrid.height() - $loading.height()) / 2
            }).show();
        }
        , _hideLoading: function(){
            var $mmGrid = this.$mmGrid;
            $mmGrid.find('.mmg-mask').hide();
            $mmGrid.find('.mmg-loading').hide();
        }
        , _showNoData: function(){
            this._showMessage(this.opts.noDataText);
        }
        , _hideNoData: function(){
            this._hideMessage();
        }

        , _showMessage: function(msg){
            var $mmGrid = this.$mmGrid;
            var $headWrapper = this.$headWrapper;
            var $message = $mmGrid.find('.mmg-message');
            $message.css({
                'left': ($mmGrid.width() - $message.width()) / 2,
                'top': ($mmGrid.height() + $headWrapper.height()  - $message.height()) / 2
            }).text(msg).show();
        }
        , _hideMessage: function(){
            var $mmGrid = this.$mmGrid;
            $mmGrid.find('.mmg-message').hide();
        }

        , _nativeSorter: function(colIndex, sortStatus){
            var col = this.opts.cols[colIndex];
            this.$body.find('tr > td:nth-child('+(colIndex+1)+')')
                .sortElements(function(a, b){
                    var av = $.text($(a));
                    var bv = $.text($(b));
                    //排序前转换
                    if(col.type === 'number'){
                        av = parseFloat(av);
                        bv = parseFloat(bv);
                    }else{
                        //各个浏览器localeCompare的结果不一致
                        return sortStatus === 'desc' ? -av.localeCompare(bv)  : av.localeCompare(bv);
                    }
                    return av > bv ? (sortStatus === 'desc' ? -1 : 1) : (sortStatus === 'desc' ? 1 : -1);
                }, function(){
                    return this.parentNode;
                });
        }

        , _refreshSortStatus: function(){
            var $ths = this.$head.find('th');
            var sortColIndex = -1;
            var sortStatus = '';
            $ths.find('.mmg-title').each(function(index, item){
                var status = $.data(item, 'sortStatus');
                if(status){
                    sortColIndex = index;
                    sortStatus = status;
                }
            });
            var sortStatus = sortStatus === 'desc' ? 'asc' : 'desc';
            if(sortColIndex >=0){
                $ths.eq(sortColIndex).find('.mmg-title').data('sortStatus',sortStatus).click();
            }
        }

        , _loadAjax: function(args){
            var that = this;
            var opts = this.data('mmGrid').opts;
            var params = {};
            //opt的params可以使函数，例如收集过滤的参数
            if($.isFunction(opts.params)){
                params = $.extend(params, opts.params());
            }else if($.isPlainObject(opts.params)){
                params = $.extend(params, opts.params);
            }

            if(opts.remoteSort){
                var sortName = '';
                var sortStatus = '';
                var $titles = this.$head.find('.mmg-title');
                for(var colIndex=0; colIndex<$titles.length; colIndex++){
                    var status = $.data($titles[colIndex], 'sortStatus');
                    if(status){
                        sortName = opts.cols[colIndex].sortName ?
                            opts.cols[colIndex].sortName : opts.cols[colIndex].name;
                        sortStatus = status;
                    }
                }
                if(sortName){
                    params.sort = sortName+'.'+sortStatus;
                }
            }

            //插件参数合并
            for(var i=0; i< this.opts.plugins.length; i++){
                var plugin = this.opts.plugins[i];
                $.extend(params, plugin.params());
            }

            //合并load的参数
            params = $.extend(params, args);
            if(params.method){
            	opts.method = params.method;
            }
            if(params.url){
            	opts.url = params.url;
            }
            if(params.params){
            	params = params.params;
            }
            
            $.ajax({
                type: opts.method,
                url: opts.url,
                data: params,
                dataType: 'json',
                cache: opts.cache
            }).done(function(data){
                //获得root对象
                var items = data;
                if($.isArray(data[opts.root])){
                    items = data[opts.root];
                }
                that._populate(items);
                if(!opts.remoteSort){
                    that._refreshSortStatus();
                }

                that.$body.triggerHandler('loadSuccess', data);

            }).fail(function(data){
                that.$body.triggerHandler('loadError', data);
            });

        }

        , _loadNative: function(args){
            this._populate(args);
            this._refreshSortStatus();
            this.$body.triggerHandler('loadSuccess', args);
        }
        , load: function(args){
            var opts = this.opts;
            this._hideMessage();
            this._showLoading();
            this._loadCount = this._loadCount + 1 ;

            if($.isArray(args)){
                //加载本地数据
                this._loadNative(args);
            }else if(opts.url){
                this._loadAjax(args);
            }else if(opts.items){
                this._loadNative(opts.items);
            }else{
                this._loadNative([]);
            }
        }

        //重设尺寸
        , resize: function(){
            var opts = this.opts;
            var $mmGrid = this.$mmGrid;
            var $headWrapper = this.$headWrapper;
            var $bodyWrapper = this.$bodyWrapper;

            // fix in ie6
            if(browser.isIE6 && (!opts.width || opts.width === 'auto')){
                $mmGrid.width('100%');
                $mmGrid.width($mmGrid.width() - ($mmGrid.outerWidth(true) - $mmGrid.width()));
            }else{
                $mmGrid.width(opts.width);
            }

            if(browser.isIE6 && (!opts.height || opts.height === 'auto')){
                $mmGrid.height('100%');
                $mmGrid.height($mmGrid.height() - ($mmGrid.outerHeight(true) - $mmGrid.height()));
            }else{
                $mmGrid.height(opts.height);
            }
            $bodyWrapper.height($mmGrid.height() - $headWrapper.outerHeight(true));

            //调整message
            var $message = $mmGrid.find('.mmg-message');
            if($message.is(':visible')){
                $message.css({
                    'left': ($mmGrid.width() - $message.width()) / 2,
                    'top': ($mmGrid.height() + $headWrapper.height() - $message.height()) / 2
                });
            }
            //调整loading
            var $mask = $mmGrid.find('.mmg-mask');
            if($mask.is(':visible')){
                $mask.width($mmGrid.width()).height($mmGrid.height());
                var $loadingWrapper = $mmGrid.find('.mmg-loading');
                $loadingWrapper.css({
                    'left': ($mmGrid.width() - $loadingWrapper.width()) / 2,
                    'top': ($mmGrid.height() - $loadingWrapper.height()) / 2
                })
            }

            $bodyWrapper.trigger('scroll');
        }

            //选中
        , select: function(args){
            var opts = this.opts;
            var $body = this.$body;

            if(typeof args === 'number'){
                var $tr = $body.find('tr').eq(args);
                if(!opts.multiSelect){
                    $body.find('tr.selected').removeClass('selected');
                    if(opts.checkCol){
                        $body.find('tr > td').find('.mmg-check').prop('checked','');
                    }
                }
                if(!$tr.hasClass('selected')){
                    $tr.addClass('selected');
                    if(opts.checkCol){
                        $tr.find('td .mmg-check').prop('checked','checked');
                    }
                }
            }else if(typeof args === 'function'){
                $.each($body.find('tr'), function(index){
                    if(args($.data(this, 'item'), index)){
                        var $this = $(this);
                        if(!$this.hasClass('selected')){
                            $this.addClass('selected');
                            if(opts.checkCol){
                                $this.find('td .mmg-check').prop('checked','checked');
                            }
                        }
                    }
                });
            }else if(args === undefined || (typeof args === 'string' && args === 'all')){
                $body.find('tr.selected').removeClass('selected');
                $body.find('tr').addClass('selected');
                $body.find('tr > td').find('.mmg-check').prop('checked','checked');
            }
        }
            //取消选中
        , deselect: function(args){
            var opts = this.opts;
            var $body = this.$body;
            if(typeof args === 'number'){
                $body.find('tr').eq(args).removeClass('selected');
                if(opts.checkCol){
                    $body.find('tr').eq(args).find('td .mmg-check').prop('checked','');
                }
            }else if(typeof args === 'function'){
                $.each($body.find('tr'), function(index){
                    if(args($.data(this, 'item'), index)){
                        $(this).removeClass('selected');
                        if(opts.checkCol){
                            $(this).find('td .mmg-check').prop('checked','');
                        }
                    }
                });
            }else if(args === undefined || (typeof args === 'string' && args === 'all')){
                $body.find('tr.selected').removeClass('selected');
                if(opts.checkCol){
                    $body.find('tr > td').find('.mmg-check').prop('checked','');
                }
            }
        }
        , selectedRows: function(){
            var $body = this.$body;
            var selected = [];
            $.each($body.find('tr.selected'), function(index ,item){
                selected.push($.data(this,'item'));
            });
            return selected;
        }

        , selectedRowsIndex: function(){
            var $body = this.$body;
            var $trs = this.$body.find('tr')
            var selected = [];
            $.each($body.find('tr.selected'), function(index){
                selected.push($trs.index(this));
            });
            return selected;
        }

        , rows: function(){
            var $body = this.$body;
            var items = [];
            $.each($body.find('tr'), function(){
                items.push($.data(this,'item'));
            });
            return items;
        }

        , row: function(index){
            var $body = this.$body;
            if(index !== undefined && index >= 0){
                var $tr = $body.find('tr').eq(index);
                if($tr.length !== 0){
                    return $.data($tr[0],'item');
                }
            }
        }

        , rowsLength: function(){
            var $body = this.$body;
            var length = $body.find('tr').length;
            if(length === 1 && $body.find('tr.emptyRow').length === 1){
                return 0;
            }
            return length;
        }

        //添加数据，第一个参数可以为数组
        , addRow: function(item, index){
            var $tbody = this.$body.find('tbody');

            if($.isArray(item)){
                for(var i=item.length-1; i >= 0; i--){
                    this.addRow(item[i], index);
                }
                return ;
            }

            if(!$.isPlainObject(item)){
                return ;
            }

            this._hideNoData();
            this._removeEmptyRow();

            var $tr;

            if(index === undefined || index < 0){
                $tr = $(this._rowHtml(item, this.rowsLength()));
                $tbody.append($tr);
            }else{
                $tr = $(this._rowHtml(item, index));
                if(index === 0){
                    $tbody.prepend($tr);
                }else{
                    var $before = $tbody.find('tr').eq(index-1);
                    //找不到就插到最后
                    if($before.length === 0){
                        $tbody.append($tr);
                    }else{
                        $before.after($($tr));
                    }
                }
            }
            $tr.data('item', item);
            this._setStyle();


            this.$body.triggerHandler('rowInserted', [item, index]);
        }
        //更新行内容，两个参数都必填
        , updateRow: function(item, index){
            var opts = this.opts;
            var $tbody = this.$body.find('tbody');
            if(!$.isPlainObject(item)){
                return ;
            }
            var oldItem = this.row(index);

            var $tr = $tbody.find('tr').eq(index);
            var checked = $tr.find('td:first :checkbox').is(':checked');
            $tr.html(this._rowHtml(item, index).slice(4,-5));
            if(opts.checkCol){
                $tr.find('td:first :checkbox').prop('checked',checked);
            }

            $tr.data('item', item);
            this._setStyle();

            this.$body.triggerHandler('rowUpdated', [oldItem, item, index]);
        }

        //删除行，参数可以为索引数组
        , removeRow: function(index){
            var that = this;
            var $tbody = that.$body.find('tbody');

            if($.isArray(index)){
                for(var i=index.length-1; i >= 0; i--){
                    that.removeRow(index[i]);
                }
                return ;
            }

            if(index === undefined){
                var $trs = $tbody.find('tr');
                for(var i=$trs.length-1; i >= 0; i--){
                    that.removeRow(i);
                }
            }else{
                var item = that.row(index);
                $tbody.find('tr').eq(index).remove();
                this.$body.triggerHandler('rowRemoved', [item, index]);
            }
            this._setStyle();
            if(this.rowsLength() === 0){
                this._showNoData();
                this._insertEmptyRow();
            }
        }
    };

    $.fn.mmGrid = function(){
        if(arguments.length === 0 || typeof arguments[0] === 'object'){
            var option = arguments[0]
                , data = this.data('mmGrid')
                , options = $.extend(true, {}, $.fn.mmGrid.defaults, option);
            if (!data) {
                data = new MMGrid(this, options);
                this.data('mmGrid', data);
            }
            return $.extend(true, this, data);
        }
        if(typeof arguments[0] === 'string'){
            var data = this.data('mmGrid');
            var fn =  data[arguments[0]];
            if(fn){
                var args = Array.prototype.slice.call(arguments);
                return fn.apply(data,args.slice(1));
            }
        }
    };

    $.fn.mmGrid.defaults = {
        width: 'auto'
        , height: '280px'
        , cols: []
        , url: false
        , params: {}
        , method: 'POST'
        , cache: false
        , root: 'items'
        , items: []
        , autoLoad: true
        , remoteSort: false
        , sortName: ''
        , sortStatus: 'asc'
        , loadingText: '正在载入...'
        , noDataText: '没有数据'
        , multiSelect: false
        , checkCol: false
        , indexCol: false
        , indexColWidth: 30
        , fullWidthRows: false
        , nowrap: false
        , plugins: [] //插件 插件必须实现 init($mmGrid)和params()方法，参考mmPaginator
    };
//  event : loadSuccess(e,data), loadError(e, data), rowSelected(item, rowIndex, colIndex)
//          rowInserted(e,item, rowIndex), rowUpdated(e, oldItem, newItem, rowIndex), rowRemoved(e,item, rowIndex)
//


    $.fn.mmGrid.Constructor = MMGrid;


    // see: http://james.padolsey.com/javascript/sorting-elements-with-jquery/
    $.fn.sortElements = (function(){
        var sort = [].sort;
        return function(comparator, getSortable) {
            getSortable = getSortable || function(){return this;};
            var placements = this.map(function(){
                var sortElement = getSortable.call(this),
                    parentNode = sortElement.parentNode,
                    nextSibling = parentNode.insertBefore(
                        document.createTextNode(''),
                        sortElement.nextSibling
                    );
                return function() {
                    if (parentNode === this) {
                        throw new Error(
                            "You can't sort elements if any one is a descendant of another."
                        );
                    }
                    parentNode.insertBefore(this, nextSibling);
                    parentNode.removeChild(nextSibling);
                };
            });
            return sort.call(this, comparator).each(function(i){
                placements[i].call(getSortable.call(this));
            });
        };
    })();
}(window.jQuery);